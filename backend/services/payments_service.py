"""
Payments service - handles deposits, invoices, and payment tracking
"""
from typing import List, Optional, Dict, Any
import json
from config.db import fetch_all, fetch_one, execute, execute_returning
from models.payments import (
    Payment, PaymentCreate, PaymentUpdate, PaymentSummary,
    PAYMENT_TYPES, PAYMENT_METHODS, PAYMENT_STATUSES
)


def _parse_json_field(value: Any) -> Any:
    """Parse JSON string to Python object if needed."""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return None
    return None


def _row_to_payment(row: Dict[str, Any]) -> Payment:
    """Convert DB row to Payment model"""
    return Payment(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        job_id=row.get("job_id"),
        installer_id=row.get("installer_id"),
        job_customer_name=row.get("job_customer_name"),
        installer_name=row.get("installer_name"),
        payment_type=row.get("payment_type", "payment"),
        payment_method=row.get("payment_method"),
        amount=float(row["amount"]) if row.get("amount") else 0.0,
        status=row.get("status", "pending"),
        paid_at=row.get("paid_at"),
        description=row.get("description"),
        reference_number=row.get("reference_number"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


async def list_payments(
    job_id: Optional[int] = None,
    installer_id: Optional[int] = None,
    status: Optional[str] = None,
    payment_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Payment]:
    """List payments with optional filtering"""
    query = """
        SELECT p.id, p.tenant_id, p.job_id, p.installer_id, p.payment_type, p.payment_method,
               p.amount, p.status, p.paid_at, p.description, p.reference_number, p.metadata,
               p.created_at, p.updated_at, p.deleted_at,
               j.customer_name as job_customer_name,
               CONCAT(i.first_name, ' ', i.last_name) as installer_name
        FROM payments p
        LEFT JOIN jobs j ON p.job_id = j.id
        LEFT JOIN installers i ON p.installer_id = i.id
        WHERE p.deleted_at IS NULL
    """
    params: Dict[str, Any] = {}

    if job_id:
        query += " AND p.job_id = :job_id"
        params["job_id"] = job_id

    if installer_id:
        query += " AND p.installer_id = :installer_id"
        params["installer_id"] = installer_id

    if status:
        query += " AND p.status = :status"
        params["status"] = status

    if payment_type:
        query += " AND p.payment_type = :payment_type"
        params["payment_type"] = payment_type

    query += " ORDER BY p.created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_payment(r) for r in rows]


async def get_payment(payment_id: int) -> Optional[Payment]:
    """Get a single payment by ID"""
    query = """
        SELECT p.id, p.tenant_id, p.job_id, p.installer_id, p.payment_type, p.payment_method,
               p.amount, p.status, p.paid_at, p.description, p.reference_number, p.metadata,
               p.created_at, p.updated_at, p.deleted_at,
               j.customer_name as job_customer_name,
               CONCAT(i.first_name, ' ', i.last_name) as installer_name
        FROM payments p
        LEFT JOIN jobs j ON p.job_id = j.id
        LEFT JOIN installers i ON p.installer_id = i.id
        WHERE p.id = :payment_id AND p.deleted_at IS NULL
    """
    row = await fetch_one(query, {"payment_id": payment_id})
    return _row_to_payment(row) if row else None


async def create_payment(data: PaymentCreate) -> Payment:
    """Create a new payment"""
    # Validate payment type
    if data.payment_type not in PAYMENT_TYPES:
        raise ValueError(f"Invalid payment_type. Must be one of: {', '.join(PAYMENT_TYPES)}")
    
    # Validate payment method if provided
    if data.payment_method and data.payment_method not in PAYMENT_METHODS:
        raise ValueError(f"Invalid payment_method. Must be one of: {', '.join(PAYMENT_METHODS)}")
    
    # Validate status if provided
    if data.status and data.status not in PAYMENT_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(PAYMENT_STATUSES)}")
    
    # Validate job exists if job_id provided
    if data.job_id:
        job_check = await fetch_one("SELECT id FROM jobs WHERE id = :job_id AND deleted_at IS NULL", {"job_id": data.job_id})
        if not job_check:
            raise ValueError(f"Job #{data.job_id} not found")
    
    query = """
        INSERT INTO payments (
            tenant_id, job_id, installer_id, payment_type, payment_method,
            amount, status, description, reference_number, metadata
        )
        VALUES (
            :tenant_id, :job_id, :installer_id, :payment_type, :payment_method,
            :amount, :status, :description, :reference_number, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "job_id": data.job_id,
        "installer_id": data.installer_id,
        "payment_type": data.payment_type,
        "payment_method": data.payment_method,
        "amount": data.amount,
        "status": data.status or "pending",
        "description": data.description,
        "reference_number": data.reference_number,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    return await get_payment(row["id"])  # type: ignore


async def update_payment(payment_id: int, data: PaymentUpdate) -> Optional[Payment]:
    """Update an existing payment"""
    updates = []
    params: Dict[str, Any] = {"payment_id": payment_id}
    
    payload = data.model_dump(exclude_unset=True)
    
    # Validate status if provided
    if "status" in payload and payload["status"] not in PAYMENT_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(PAYMENT_STATUSES)}")
    
    # Validate payment method if provided
    if "payment_method" in payload and payload["payment_method"] and payload["payment_method"] not in PAYMENT_METHODS:
        raise ValueError(f"Invalid payment_method. Must be one of: {', '.join(PAYMENT_METHODS)}")
    
    field_mappings = {
        "status": "status",
        "payment_method": "payment_method",
        "paid_at": "paid_at",
        "description": "description",
        "reference_number": "reference_number",
    }
    
    for field_name, db_field in field_mappings.items():
        if field_name in payload:
            updates.append(f"{db_field} = :{db_field}")
            params[db_field] = payload[field_name]
    
    if "metadata" in payload:
        updates.append("metadata = CAST(:metadata AS jsonb)")
        params["metadata"] = json.dumps(payload["metadata"]) if payload["metadata"] else "{}"

    if not updates:
        return await get_payment(payment_id)

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)
    
    query = f"""
        UPDATE payments SET {set_clause}
        WHERE id = :payment_id AND deleted_at IS NULL
        RETURNING id
    """
    
    row = await execute_returning(query, params)
    if not row:
        return None
    return await get_payment(payment_id)


async def delete_payment(payment_id: int) -> bool:
    """Soft delete a payment"""
    query = "UPDATE payments SET deleted_at = NOW() WHERE id = :payment_id AND deleted_at IS NULL"
    count = await execute(query, {"payment_id": payment_id})
    return count > 0


async def update_payment_status(payment_id: int, status: str, paid_at: Optional[str] = None) -> Optional[Payment]:
    """Update payment status with validation"""
    if status not in PAYMENT_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(PAYMENT_STATUSES)}")
    
    query = """
        UPDATE payments 
        SET status = :status, 
            paid_at = COALESCE(:paid_at, paid_at, CASE WHEN :status = 'completed' THEN NOW() ELSE NULL END),
            updated_at = NOW()
        WHERE id = :payment_id AND deleted_at IS NULL
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "payment_id": payment_id,
        "status": status,
        "paid_at": paid_at,
    })
    
    if not row:
        return None
    return await get_payment(payment_id)


async def get_payment_summary_for_job(job_id: int) -> PaymentSummary:
    """Get payment summary for a specific job"""
    query = """
        SELECT 
            COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_paid,
            COALESCE(SUM(CASE WHEN status IN ('pending', 'processing') THEN amount ELSE 0 END), 0) as total_pending,
            COALESCE(SUM(CASE WHEN payment_type = 'refund' AND status = 'completed' THEN amount ELSE 0 END), 0) as total_refunded,
            COUNT(*) as payment_count
        FROM payments
        WHERE job_id = :job_id AND deleted_at IS NULL
    """
    
    row = await fetch_one(query, {"job_id": job_id})
    
    if not row:
        return PaymentSummary()
    
    total_paid = float(row["total_paid"]) if row["total_paid"] else 0.0
    total_pending = float(row["total_pending"]) if row["total_pending"] else 0.0
    total_refunded = float(row["total_refunded"]) if row["total_refunded"] else 0.0
    
    # Get job total to calculate outstanding balance
    job_query = "SELECT total_price FROM quotes WHERE id = (SELECT quote_id FROM jobs WHERE id = :job_id)"
    job_row = await fetch_one(job_query, {"job_id": job_id})
    job_total = float(job_row["total_price"]) if job_row and job_row["total_price"] else 0.0
    
    outstanding = max(0.0, job_total - total_paid + total_refunded)
    
    return PaymentSummary(
        total_paid=total_paid,
        total_pending=total_pending,
        total_refunded=total_refunded,
        outstanding_balance=outstanding,
        payment_count=row["payment_count"] or 0,
    )


async def get_payment_summary_for_installer(installer_id: int) -> PaymentSummary:
    """Get payment summary for a specific installer"""
    query = """
        SELECT 
            COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_paid,
            COALESCE(SUM(CASE WHEN status IN ('pending', 'processing') THEN amount ELSE 0 END), 0) as total_pending,
            COUNT(*) as payment_count
        FROM payments
        WHERE installer_id = :installer_id AND deleted_at IS NULL
    """
    
    row = await fetch_one(query, {"installer_id": installer_id})
    
    if not row:
        return PaymentSummary()
    
    return PaymentSummary(
        total_paid=float(row["total_paid"]) if row["total_paid"] else 0.0,
        total_pending=float(row["total_pending"]) if row["total_pending"] else 0.0,
        payment_count=row["payment_count"] or 0,
    )
