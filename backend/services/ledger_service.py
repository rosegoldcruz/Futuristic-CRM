"""
Ledger service - double-entry bookkeeping for payment reconciliation
"""
from typing import List, Optional, Dict, Any
import json
from datetime import datetime
from config.db import fetch_all, fetch_one, execute_returning
from models.payments import LedgerEntry, LedgerEntryCreate


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


def _row_to_ledger_entry(row: Dict[str, Any]) -> LedgerEntry:
    """Convert DB row to LedgerEntry model"""
    return LedgerEntry(
        id=row["id"],
        tenant_id=row.get("tenant_id"),
        transaction_id=row.get("transaction_id"),
        entry_type=row.get("entry_type"),
        entity_type=row.get("entity_type"),
        entity_id=row.get("entity_id"),
        debit=float(row.get("debit", 0)),
        credit=float(row.get("credit", 0)),
        balance=float(row.get("balance", 0)),
        description=row.get("description"),
        metadata=_parse_json_field(row.get("metadata")),
        created_at=row.get("created_at"),
    )


async def create_ledger_entry(data: LedgerEntryCreate) -> LedgerEntry:
    """Create a new ledger entry"""
    query = """
        INSERT INTO ledger_entries (
            tenant_id, transaction_id, entry_type, entity_type, entity_id,
            debit, credit, balance, description, metadata
        )
        VALUES (
            :tenant_id, :transaction_id, :entry_type, :entity_type, :entity_id,
            :debit, :credit, :balance, :description, CAST(:metadata AS jsonb)
        )
        RETURNING id
    """
    
    row = await execute_returning(query, {
        "tenant_id": data.tenant_id,
        "transaction_id": data.transaction_id,
        "entry_type": data.entry_type,
        "entity_type": data.entity_type,
        "entity_id": data.entity_id,
        "debit": data.debit,
        "credit": data.credit,
        "balance": data.balance or 0.0,
        "description": data.description,
        "metadata": json.dumps(data.metadata) if data.metadata else "{}",
    })
    
    query = "SELECT * FROM ledger_entries WHERE id = :entry_id"
    row = await fetch_one(query, {"entry_id": row["id"]})
    return _row_to_ledger_entry(row) if row else None  # type: ignore


async def create_double_entry(
    transaction_id: str,
    debit_entry: LedgerEntryCreate,
    credit_entry: LedgerEntryCreate,
) -> Dict[str, LedgerEntry]:
    """
    Create matching debit and credit entries for double-entry bookkeeping
    
    Rules:
    - Every debit must have an equal and opposite credit
    - Debits increase asset/expense accounts
    - Credits increase liability/revenue accounts
    """
    # Ensure transaction IDs match
    debit_entry.transaction_id = transaction_id
    credit_entry.transaction_id = transaction_id
    
    # Create both entries
    debit = await create_ledger_entry(debit_entry)
    credit = await create_ledger_entry(credit_entry)
    
    return {"debit": debit, "credit": credit}


async def record_payment_charge(
    payment_id: int,
    amount: float,
    homeowner_id: int,
    tenant_id: Optional[int] = None,
) -> Dict[str, LedgerEntry]:
    """Record a payment charge in the ledger"""
    transaction_id = f"charge_{payment_id}_{datetime.now().timestamp()}"
    
    # Debit: Cash/Bank account (asset increases)
    debit_entry = LedgerEntryCreate(
        tenant_id=tenant_id,
        transaction_id=transaction_id,
        entry_type="charge",
        entity_type="payment",
        entity_id=payment_id,
        debit=amount,
        credit=0.0,
        description=f"Payment charge #{payment_id}",
        metadata={"homeowner_id": homeowner_id},
    )
    
    # Credit: Accounts Receivable (liability decreases)
    credit_entry = LedgerEntryCreate(
        tenant_id=tenant_id,
        transaction_id=transaction_id,
        entry_type="charge",
        entity_type="homeowner",
        entity_id=homeowner_id,
        debit=0.0,
        credit=amount,
        description=f"Payment received from homeowner #{homeowner_id}",
        metadata={"payment_id": payment_id},
    )
    
    return await create_double_entry(transaction_id, debit_entry, credit_entry)


async def record_platform_fee(
    payment_id: int,
    fee_amount: float,
    tenant_id: Optional[int] = None,
) -> Dict[str, LedgerEntry]:
    """Record platform fee in the ledger"""
    transaction_id = f"fee_{payment_id}_{datetime.now().timestamp()}"
    
    # Debit: Platform Revenue (revenue increases - normal credit, reversed as debit)
    debit_entry = LedgerEntryCreate(
        tenant_id=tenant_id,
        transaction_id=transaction_id,
        entry_type="fee",
        entity_type="payment",
        entity_id=payment_id,
        debit=fee_amount,
        credit=0.0,
        description=f"Platform fee for payment #{payment_id}",
        metadata={"fee_type": "platform"},
    )
    
    # Credit: Cash (asset decreases)
    credit_entry = LedgerEntryCreate(
        tenant_id=tenant_id,
        transaction_id=transaction_id,
        entry_type="fee",
        entity_type="platform",
        entity_id=None,
        debit=0.0,
        credit=fee_amount,
        description=f"Platform fee collected",
        metadata={"payment_id": payment_id},
    )
    
    return await create_double_entry(transaction_id, debit_entry, credit_entry)


async def record_refund(
    payment_id: int,
    refund_amount: float,
    homeowner_id: int,
    tenant_id: Optional[int] = None,
) -> Dict[str, LedgerEntry]:
    """Record a refund in the ledger"""
    transaction_id = f"refund_{payment_id}_{datetime.now().timestamp()}"
    
    # Debit: Accounts Receivable (liability increases)
    debit_entry = LedgerEntryCreate(
        tenant_id=tenant_id,
        transaction_id=transaction_id,
        entry_type="refund",
        entity_type="homeowner",
        entity_id=homeowner_id,
        debit=refund_amount,
        credit=0.0,
        description=f"Refund issued to homeowner #{homeowner_id}",
        metadata={"payment_id": payment_id},
    )
    
    # Credit: Cash/Bank (asset decreases)
    credit_entry = LedgerEntryCreate(
        tenant_id=tenant_id,
        transaction_id=transaction_id,
        entry_type="refund",
        entity_type="payment",
        entity_id=payment_id,
        debit=0.0,
        credit=refund_amount,
        description=f"Refund for payment #{payment_id}",
        metadata={"homeowner_id": homeowner_id},
    )
    
    return await create_double_entry(transaction_id, debit_entry, credit_entry)


async def record_installer_payout(
    installer_id: int,
    payout_amount: float,
    job_id: int,
    tenant_id: Optional[int] = None,
) -> Dict[str, LedgerEntry]:
    """Record an installer payout in the ledger"""
    transaction_id = f"payout_{installer_id}_{datetime.now().timestamp()}"
    
    # Debit: Accounts Payable (liability decreases)
    debit_entry = LedgerEntryCreate(
        tenant_id=tenant_id,
        transaction_id=transaction_id,
        entry_type="payout",
        entity_type="installer",
        entity_id=installer_id,
        debit=payout_amount,
        credit=0.0,
        description=f"Payout to installer #{installer_id}",
        metadata={"job_id": job_id},
    )
    
    # Credit: Cash/Bank (asset decreases)
    credit_entry = LedgerEntryCreate(
        tenant_id=tenant_id,
        transaction_id=transaction_id,
        entry_type="payout",
        entity_type="job",
        entity_id=job_id,
        debit=0.0,
        credit=payout_amount,
        description=f"Installer payout for job #{job_id}",
        metadata={"installer_id": installer_id},
    )
    
    return await create_double_entry(transaction_id, debit_entry, credit_entry)


async def list_ledger_entries(
    tenant_id: Optional[int] = None,
    transaction_id: Optional[str] = None,
    entry_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[LedgerEntry]:
    """List ledger entries with filtering"""
    query = "SELECT * FROM ledger_entries WHERE 1=1"
    params: Dict[str, Any] = {}

    if tenant_id:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id

    if transaction_id:
        query += " AND transaction_id = :transaction_id"
        params["transaction_id"] = transaction_id

    if entry_type:
        query += " AND entry_type = :entry_type"
        params["entry_type"] = entry_type

    if entity_type:
        query += " AND entity_type = :entity_type"
        params["entity_type"] = entity_type

    if entity_id:
        query += " AND entity_id = :entity_id"
        params["entity_id"] = entity_id

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    rows = await fetch_all(query, params)
    return [_row_to_ledger_entry(r) for r in rows]


async def verify_ledger_balance(
    transaction_id: Optional[str] = None,
    tenant_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Verify that debits equal credits for ledger reconciliation
    Returns True if balanced, False if drift detected
    """
    query = """
        SELECT 
            SUM(debit) as total_debits,
            SUM(credit) as total_credits,
            COUNT(*) as entry_count
        FROM ledger_entries
        WHERE 1=1
    """
    params: Dict[str, Any] = {}
    
    if transaction_id:
        query += " AND transaction_id = :transaction_id"
        params["transaction_id"] = transaction_id
    
    if tenant_id:
        query += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id
    
    row = await fetch_one(query, params)
    
    if not row:
        return {"balanced": True, "drift": 0.0, "entry_count": 0}
    
    total_debits = float(row["total_debits"] or 0)
    total_credits = float(row["total_credits"] or 0)
    drift = abs(total_debits - total_credits)
    
    # Allow for floating point rounding (drift < $0.01)
    balanced = drift < 0.01
    
    return {
        "balanced": balanced,
        "total_debits": total_debits,
        "total_credits": total_credits,
        "drift": drift,
        "entry_count": row["entry_count"],
    }
