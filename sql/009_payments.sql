-- ===========================================================
-- 009_PAYMENTS.SQL (UPGRADED)
-- Payment Processing, Invoicing, Split Payouts, Ledger
-- Stripe Integration Ready
-- AEON-grade: All 11 patches applied inline
-- Depends on: 000, 004, 005, 006, 007
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE payment_status AS ENUM ('pending','processing','succeeded','failed','refunded','partially_refunded','disputed','cancelled');
CREATE TYPE payment_type AS ENUM ('deposit','progress','final','refund','fee','adjustment','financing');
CREATE TYPE payment_method_type AS ENUM ('card','bank_account','check','cash','financing','wire','other');
CREATE TYPE invoice_status AS ENUM ('draft','sent','viewed','paid','partial','overdue','void','cancelled');
CREATE TYPE payout_status AS ENUM ('pending','approved','processing','paid','failed','cancelled');
CREATE TYPE payout_type AS ENUM ('job_payment','referral_bonus','bonus','adjustment','correction','reimbursement');
CREATE TYPE ledger_entry_type AS ENUM ('debit','credit');
CREATE TYPE ledger_account_type AS ENUM ('asset','liability','equity','revenue','expense');

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  homeowner_id UUID NOT NULL REFERENCES homeowners(id) ON DELETE CASCADE,
  type payment_method_type NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  label TEXT, last_four TEXT, brand TEXT, exp_month INT, exp_year INT, bank_name TEXT,
  stripe_payment_method_id TEXT, stripe_customer_id TEXT,
  billing_address JSONB DEFAULT '{}',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
) WITH (fillfactor = 90);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  homeowner_id UUID NOT NULL REFERENCES homeowners(id),
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE, sent_at TIMESTAMPTZ, viewed_at TIMESTAMPTZ, paid_at TIMESTAMPTZ, voided_at TIMESTAMPTZ,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  tax_rate NUMERIC(5,4) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_due NUMERIC(12,2) GENERATED ALWAYS AS (GREATEST(0, total - amount_paid)) STORED,
  payment_terms TEXT DEFAULT 'Due on Receipt',
  public_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  bill_to JSONB DEFAULT '{}',
  notes TEXT, internal_notes TEXT, terms_and_conditions TEXT,
  reminder_count INT DEFAULT 0, last_reminder_at TIMESTAMPTZ, next_reminder_at TIMESTAMPTZ,
  stripe_invoice_id TEXT, stripe_hosted_url TEXT, stripe_pdf_url TEXT,
  audit_log JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, deleted_by UUID, created_by UUID, updated_by UUID
) WITH (fillfactor = 90);

CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  job_line_item_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  unit TEXT DEFAULT 'each',
  line_total NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  is_taxable BOOLEAN NOT NULL DEFAULT true,
  sort_order INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  homeowner_id UUID NOT NULL REFERENCES homeowners(id),
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  type payment_type NOT NULL DEFAULT 'final',
  status payment_status NOT NULL DEFAULT 'pending',
  amount NUMERIC(12,2) NOT NULL,
  fee_amount NUMERIC(10,2) DEFAULT 0,
  net_amount NUMERIC(12,2) GENERATED ALWAYS AS (amount - COALESCE(fee_amount, 0)) STORED,
  refunded_amount NUMERIC(10,2) DEFAULT 0,
  refundable_amount NUMERIC(12,2) GENERATED ALWAYS AS (amount - COALESCE(refunded_amount, 0)) STORED,
  method_type payment_method_type NOT NULL,
  method_last_four TEXT, method_brand TEXT,
  stripe_payment_intent_id TEXT, stripe_charge_id TEXT, stripe_customer_id TEXT, stripe_receipt_url TEXT,
  check_number TEXT, check_date DATE, cash_received_by UUID,
  financing_provider TEXT, financing_reference TEXT,
  processed_at TIMESTAMPTZ, failed_at TIMESTAMPTZ, failure_reason TEXT, failure_code TEXT,
  disputed_at TIMESTAMPTZ, dispute_reason TEXT, dispute_resolved_at TIMESTAMPTZ,
  description TEXT, internal_notes TEXT,
  audit_log JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, deleted_by UUID, created_by UUID, updated_by UUID
) WITH (fillfactor = 90);

CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  previous_value JSONB, new_value JSONB,
  description TEXT,
  performed_by UUID, performed_by_system BOOLEAN NOT NULL DEFAULT false,
  stripe_event_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payout_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  installer_id UUID REFERENCES installers(id) ON DELETE SET NULL,
  homeowner_id UUID REFERENCES homeowners(id) ON DELETE SET NULL,
  recipient_type TEXT NOT NULL, recipient_name TEXT NOT NULL,
  type payout_type NOT NULL DEFAULT 'job_payment',
  status payout_status NOT NULL DEFAULT 'pending',
  gross_amount NUMERIC(12,2) NOT NULL,
  deductions NUMERIC(10,2) DEFAULT 0,
  net_amount NUMERIC(12,2) GENERATED ALWAYS AS (gross_amount - COALESCE(deductions, 0)) STORED,
  payout_method TEXT NOT NULL,
  bank_account_id UUID, bank_account_last_four TEXT,
  stripe_transfer_id TEXT, stripe_payout_id TEXT, stripe_destination_id TEXT,
  check_number TEXT, check_date DATE, check_mailed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ, approved_by UUID,
  processed_at TIMESTAMPTZ, paid_at TIMESTAMPTZ, failed_at TIMESTAMPTZ, failure_reason TEXT,
  period_start DATE, period_end DATE,
  description TEXT, internal_notes TEXT,
  audit_log JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, deleted_by UUID, created_by UUID, updated_by UUID
) WITH (fillfactor = 90);

CREATE TABLE payout_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payout_id UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  type payout_type NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  reference_type TEXT, reference_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

CREATE TABLE ledger_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
  type ledger_account_type NOT NULL,
  parent_id UUID REFERENCES ledger_accounts(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, code)
) WITH (fillfactor = 90);

CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_number TEXT,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  type ledger_entry_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  balance_after NUMERIC(14,2),
  description TEXT,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  payout_id UUID REFERENCES payouts(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_reconciled BOOLEAN NOT NULL DEFAULT false,
  reconciled_at TIMESTAMPTZ, reconciled_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_payment_methods_tenant ON payment_methods(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_methods_homeowner ON payment_methods(homeowner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_methods_default ON payment_methods(homeowner_id) WHERE is_default = true AND deleted_at IS NULL;
CREATE INDEX idx_payment_methods_stripe ON payment_methods(stripe_payment_method_id) WHERE stripe_payment_method_id IS NOT NULL;

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_homeowner ON invoices(homeowner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_job ON invoices(job_id) WHERE deleted_at IS NULL AND job_id IS NOT NULL;
CREATE INDEX idx_invoices_status ON invoices(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_due_date ON invoices(tenant_id, due_date) WHERE deleted_at IS NULL AND status NOT IN ('paid', 'void', 'cancelled');
CREATE INDEX idx_invoices_public_token ON invoices(public_token) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_stripe ON invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
CREATE INDEX idx_invoices_created ON invoices(tenant_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_tenant ON invoice_line_items(tenant_id);

CREATE INDEX idx_payments_tenant ON payments(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_homeowner ON payments(homeowner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_invoice ON payments(invoice_id) WHERE deleted_at IS NULL AND invoice_id IS NOT NULL;
CREATE INDEX idx_payments_job ON payments(job_id) WHERE deleted_at IS NULL AND job_id IS NOT NULL;
CREATE INDEX idx_payments_status ON payments(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_stripe_intent ON payments(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX idx_payments_created ON payments(tenant_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX idx_payment_events_payment ON payment_events(payment_id);
CREATE INDEX idx_payment_events_tenant ON payment_events(tenant_id);
CREATE INDEX idx_payment_events_stripe ON payment_events(stripe_event_id) WHERE stripe_event_id IS NOT NULL;

CREATE INDEX idx_payouts_tenant ON payouts(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payouts_installer ON payouts(installer_id) WHERE deleted_at IS NULL AND installer_id IS NOT NULL;
CREATE INDEX idx_payouts_status ON payouts(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_payouts_pending ON payouts(tenant_id) WHERE deleted_at IS NULL AND status = 'pending';
CREATE INDEX idx_payouts_stripe ON payouts(stripe_transfer_id) WHERE stripe_transfer_id IS NOT NULL;

CREATE INDEX idx_payout_items_payout ON payout_items(payout_id);
CREATE INDEX idx_payout_items_tenant ON payout_items(tenant_id);

CREATE INDEX idx_ledger_accounts_tenant ON ledger_accounts(tenant_id);
CREATE INDEX idx_ledger_accounts_code ON ledger_accounts(tenant_id, code);
CREATE INDEX idx_ledger_entries_tenant ON ledger_entries(tenant_id);
CREATE INDEX idx_ledger_entries_transaction ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_entries_account ON ledger_entries(account_id);
CREATE INDEX idx_ledger_entries_date ON ledger_entries(tenant_id, entry_date DESC);

-- ============================================
-- TRIGGERS (UPGRADED: SECURITY DEFINER on number generators)
-- ============================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := next_tenant_sequence(NEW.tenant_id, 'invoice', 'VUL');
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := NULLIF(auth.jwt() ->> 'user_id', '')::UUID;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invoice_number_trigger BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_number IS NULL THEN
    NEW.payment_number := next_tenant_sequence(NEW.tenant_id, 'payment', 'VUL');
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := NULLIF(auth.jwt() ->> 'user_id', '')::UUID;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_number_trigger BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION generate_payment_number();

CREATE OR REPLACE FUNCTION generate_payout_number()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payout_number IS NULL THEN
    NEW.payout_number := next_tenant_sequence(NEW.tenant_id, 'payout', 'VUL');
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := NULLIF(auth.jwt() ->> 'user_id', '')::UUID;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payout_number_trigger BEFORE INSERT ON payouts FOR EACH ROW EXECUTE FUNCTION generate_payout_number();

CREATE OR REPLACE FUNCTION update_financial_updated_at()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  IF NEW.updated_by IS NULL THEN
    NEW.updated_by := NULLIF(auth.jwt() ->> 'user_id', '')::UUID;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_financial_updated_at();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_financial_updated_at();
CREATE TRIGGER payouts_updated_at BEFORE UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION update_financial_updated_at();
CREATE TRIGGER payment_methods_updated_at BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER invoice_line_items_updated_at BEFORE UPDATE ON invoice_line_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ledger_accounts_updated_at BEFORE UPDATE ON ledger_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER invoices_audit BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION audit_entity();
CREATE TRIGGER payments_audit BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION audit_entity();
CREATE TRIGGER payouts_audit BEFORE UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION audit_entity();

-- UPGRADED: Recalculate invoice totals with DELETE guard
CREATE OR REPLACE FUNCTION recalculate_invoice_totals()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE
  v_invoice_id UUID;
  v_subtotal NUMERIC(12,2);
  v_taxable_subtotal NUMERIC(12,2);
BEGIN
  IF TG_OP = 'DELETE' THEN v_invoice_id := OLD.invoice_id;
  ELSE v_invoice_id := NEW.invoice_id;
  END IF;
  
  SELECT COALESCE(SUM(line_total), 0), COALESCE(SUM(CASE WHEN is_taxable THEN line_total ELSE 0 END), 0)
  INTO v_subtotal, v_taxable_subtotal
  FROM invoice_line_items WHERE invoice_id = v_invoice_id;
  
  UPDATE invoices SET 
    subtotal = v_subtotal,
    tax_amount = ROUND(v_taxable_subtotal * COALESCE(tax_rate, 0), 2),
    total = v_subtotal - COALESCE(discount_amount, 0) + ROUND(v_taxable_subtotal * COALESCE(tax_rate, 0), 2)
  WHERE id = v_invoice_id;
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invoice_line_items_recalc AFTER INSERT OR UPDATE OR DELETE ON invoice_line_items FOR EACH ROW EXECUTE FUNCTION recalculate_invoice_totals();

CREATE OR REPLACE FUNCTION update_invoice_payment()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invoice_id IS NOT NULL AND NEW.status = 'succeeded' AND (OLD.status IS DISTINCT FROM 'succeeded' OR TG_OP = 'INSERT') THEN
    UPDATE invoices SET 
      amount_paid = amount_paid + NEW.amount,
      status = CASE WHEN amount_paid + NEW.amount >= total THEN 'paid'::invoice_status WHEN amount_paid + NEW.amount > 0 THEN 'partial'::invoice_status ELSE status END,
      paid_at = CASE WHEN amount_paid + NEW.amount >= total THEN NOW() ELSE paid_at END
    WHERE id = NEW.invoice_id;
  END IF;
  IF NEW.invoice_id IS NOT NULL AND NEW.status = 'refunded' AND OLD.status = 'succeeded' THEN
    UPDATE invoices SET 
      amount_paid = GREATEST(0, amount_paid - NEW.amount),
      status = CASE WHEN GREATEST(0, amount_paid - NEW.amount) = 0 THEN 'sent'::invoice_status WHEN GREATEST(0, amount_paid - NEW.amount) < total THEN 'partial'::invoice_status ELSE status END
    WHERE id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payments_update_invoice AFTER INSERT OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_invoice_payment();

CREATE OR REPLACE FUNCTION log_payment_status_change()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status WHEN 'succeeded' THEN NEW.processed_at := COALESCE(NEW.processed_at, NOW());
    WHEN 'failed' THEN NEW.failed_at := COALESCE(NEW.failed_at, NOW());
    WHEN 'disputed' THEN NEW.disputed_at := COALESCE(NEW.disputed_at, NOW()); ELSE NULL; END CASE;
    INSERT INTO payment_events (payment_id, tenant_id, event_type, previous_value, new_value, description, performed_by, performed_by_system)
    VALUES (NEW.id, NEW.tenant_id, NEW.status::TEXT, jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status),
            'Payment status changed from ' || OLD.status || ' to ' || NEW.status, NULLIF(auth.jwt() ->> 'user_id', '')::UUID, auth.jwt() IS NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payments_status_change BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION log_payment_status_change();

CREATE OR REPLACE FUNCTION update_job_payment_status()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE v_total_paid NUMERIC; v_job_total NUMERIC;
BEGIN
  IF NEW.job_id IS NOT NULL AND NEW.status = 'succeeded' THEN
    SELECT COALESCE(SUM(p.amount), 0), COALESCE(j.final_total, j.quoted_total, 0) INTO v_total_paid, v_job_total
    FROM payments p CROSS JOIN jobs j WHERE p.job_id = NEW.job_id AND p.status = 'succeeded' AND p.deleted_at IS NULL AND j.id = NEW.job_id;
    UPDATE jobs SET amount_paid = v_total_paid, payment_status = CASE WHEN v_total_paid >= v_job_total THEN 'paid' WHEN v_total_paid > 0 THEN 'partial' ELSE 'unpaid' END WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payments_update_job AFTER INSERT OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_job_payment_status();

CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE payment_methods SET is_default = false WHERE homeowner_id = NEW.homeowner_id AND id != NEW.id AND is_default = true AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_methods_default BEFORE INSERT OR UPDATE ON payment_methods FOR EACH ROW WHEN (NEW.is_default = true) EXECUTE FUNCTION ensure_single_default_payment_method();

-- ============================================
-- ROW LEVEL SECURITY (UPGRADED: All 11 patches applied)
-- ============================================

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods FORCE ROW LEVEL SECURITY;

CREATE POLICY payment_methods_select ON payment_methods FOR SELECT USING (
  deleted_at IS NULL AND (
    (auth.jwt() ->> 'role') = 'superadmin' OR
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  ) AND NOT EXISTS (SELECT 1 FROM homeowners h WHERE h.id = payment_methods.homeowner_id AND h.deleted_at IS NOT NULL)
);

CREATE POLICY payment_methods_insert ON payment_methods FOR INSERT WITH CHECK (
  tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  AND EXISTS (SELECT 1 FROM homeowners WHERE id = homeowner_id AND homeowners.tenant_id = payment_methods.tenant_id AND homeowners.deleted_at IS NULL)
);

CREATE POLICY payment_methods_update ON payment_methods FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)))
  WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY payment_methods_delete ON payment_methods FOR DELETE USING (false);

-- INVOICES
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

CREATE POLICY invoices_select ON invoices FOR SELECT USING (
  deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID))
);

CREATE POLICY invoices_insert ON invoices FOR INSERT WITH CHECK (
  tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  AND EXISTS (SELECT 1 FROM homeowners WHERE id = homeowner_id AND homeowners.tenant_id = invoices.tenant_id AND homeowners.deleted_at IS NULL)
  AND (job_id IS NULL OR EXISTS (SELECT 1 FROM jobs WHERE id = job_id AND jobs.tenant_id = invoices.tenant_id AND jobs.deleted_at IS NULL))
);

CREATE POLICY invoices_update ON invoices FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)))
  WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY invoices_delete ON invoices FOR DELETE USING (false);

-- INVOICE_LINE_ITEMS
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items FORCE ROW LEVEL SECURITY;

CREATE POLICY invoice_line_items_select ON invoice_line_items FOR SELECT USING (
  ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID))
  AND EXISTS (SELECT 1 FROM invoices WHERE id = invoice_line_items.invoice_id AND deleted_at IS NULL)
);

CREATE POLICY invoice_line_items_insert ON invoice_line_items FOR INSERT WITH CHECK (
  tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  AND EXISTS (SELECT 1 FROM invoices WHERE id = invoice_id AND invoices.tenant_id = invoice_line_items.tenant_id AND invoices.deleted_at IS NULL)
);

CREATE POLICY invoice_line_items_update ON invoice_line_items FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID))
  WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

-- UPGRADED: Delete policy enforces parent invoice ownership
CREATE POLICY invoice_line_items_delete ON invoice_line_items FOR DELETE USING (
  (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin', 'manager')
  AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  AND EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_line_items.invoice_id AND i.tenant_id = invoice_line_items.tenant_id AND i.deleted_at IS NULL)
);

-- PAYMENTS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

CREATE POLICY payments_select ON payments FOR SELECT USING (
  deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID))
);

CREATE POLICY payments_insert ON payments FOR INSERT WITH CHECK (
  tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  AND EXISTS (SELECT 1 FROM homeowners WHERE id = homeowner_id AND homeowners.tenant_id = payments.tenant_id AND homeowners.deleted_at IS NULL)
  AND (invoice_id IS NULL OR EXISTS (SELECT 1 FROM invoices WHERE id = invoice_id AND invoices.tenant_id = payments.tenant_id AND invoices.deleted_at IS NULL))
  AND (job_id IS NULL OR EXISTS (SELECT 1 FROM jobs WHERE id = job_id AND jobs.tenant_id = payments.tenant_id AND jobs.deleted_at IS NULL))
);

CREATE POLICY payments_update ON payments FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)))
  WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY payments_delete ON payments FOR DELETE USING (false);

-- PAYMENT_EVENTS (UPGRADED: Hide events for soft-deleted payments)
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events FORCE ROW LEVEL SECURITY;

CREATE POLICY payment_events_select ON payment_events FOR SELECT USING (
  ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID))
  AND EXISTS (SELECT 1 FROM payments p WHERE p.id = payment_events.payment_id AND p.deleted_at IS NULL)
);

CREATE POLICY payment_events_insert ON payment_events FOR INSERT WITH CHECK (
  tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  AND EXISTS (SELECT 1 FROM payments p WHERE p.id = payment_id AND p.tenant_id = payment_events.tenant_id AND p.deleted_at IS NULL)
);

CREATE POLICY payment_events_update ON payment_events FOR UPDATE USING (false);
CREATE POLICY payment_events_delete ON payment_events FOR DELETE USING (false);

-- PAYOUTS (UPGRADED: Hide payouts for soft-deleted installers)
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts FORCE ROW LEVEL SECURITY;

CREATE POLICY payouts_select ON payouts FOR SELECT USING (
  deleted_at IS NULL AND (
    (auth.jwt() ->> 'role') = 'superadmin' OR
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID) OR
    (installer_id IS NOT NULL AND EXISTS (SELECT 1 FROM installers WHERE id = installer_id AND user_id = (auth.jwt() ->> 'user_id')::UUID AND deleted_at IS NULL))
  ) AND NOT EXISTS (SELECT 1 FROM installers i WHERE i.id = payouts.installer_id AND i.deleted_at IS NOT NULL)
);

CREATE POLICY payouts_insert ON payouts FOR INSERT WITH CHECK (
  tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  AND (installer_id IS NULL OR EXISTS (SELECT 1 FROM installers WHERE id = installer_id AND installers.tenant_id = payouts.tenant_id AND installers.deleted_at IS NULL))
);

CREATE POLICY payouts_update ON payouts FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR ((auth.jwt() ->> 'role') IN ('owner', 'admin', 'manager') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID))))
  WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY payouts_delete ON payouts FOR DELETE USING (false);

-- PAYOUT_ITEMS (UPGRADED: Hide items for soft-deleted payouts)
ALTER TABLE payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_items FORCE ROW LEVEL SECURITY;

CREATE POLICY payout_items_select ON payout_items FOR SELECT USING (
  ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID))
  AND EXISTS (SELECT 1 FROM payouts p WHERE p.id = payout_items.payout_id AND p.deleted_at IS NULL)
);

CREATE POLICY payout_items_insert ON payout_items FOR INSERT WITH CHECK (
  tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  AND EXISTS (SELECT 1 FROM payouts WHERE id = payout_id AND payouts.tenant_id = payout_items.tenant_id AND payouts.deleted_at IS NULL)
);

CREATE POLICY payout_items_update ON payout_items FOR UPDATE USING (false);
CREATE POLICY payout_items_delete ON payout_items FOR DELETE USING (
  (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
  AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
);

-- LEDGER_ACCOUNTS (UPGRADED: Block updates to system accounts)
ALTER TABLE ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_accounts FORCE ROW LEVEL SECURITY;

CREATE POLICY ledger_accounts_select ON ledger_accounts FOR SELECT USING (
  (auth.jwt() ->> 'role') = 'superadmin' OR tenant_id IS NULL OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
);

CREATE POLICY ledger_accounts_insert ON ledger_accounts FOR INSERT WITH CHECK (
  (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
  AND (tenant_id IS NULL OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID))
);

CREATE POLICY ledger_accounts_update ON ledger_accounts FOR UPDATE
  USING ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin') AND is_system = false AND (tenant_id IS NULL OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)))
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin') AND is_system = false AND (tenant_id IS NULL OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY ledger_accounts_delete ON ledger_accounts FOR DELETE USING (false);

-- LEDGER_ENTRIES (UPGRADED: Hide entries tied to soft-deleted payments/payouts)
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries FORCE ROW LEVEL SECURITY;

CREATE POLICY ledger_entries_select ON ledger_entries FOR SELECT USING (
  ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID))
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = ledger_entries.payment_id AND p.deleted_at IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM payouts po WHERE po.id = ledger_entries.payout_id AND po.deleted_at IS NOT NULL)
);

CREATE POLICY ledger_entries_insert ON ledger_entries FOR INSERT WITH CHECK (
  tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
);

CREATE POLICY ledger_entries_update ON ledger_entries FOR UPDATE USING (
  (auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin')
  AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  AND is_reconciled = false
);

CREATE POLICY ledger_entries_delete ON ledger_entries FOR DELETE USING (false);

-- ============================================
-- HELPER FUNCTIONS (UPGRADED: All tenant guards + pre-checks)
-- ============================================

-- Create invoice from job
CREATE OR REPLACE FUNCTION create_invoice_from_job(p_job_id UUID, p_include_line_items BOOLEAN DEFAULT true)
RETURNS UUID SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE v_invoice_id UUID; v_job RECORD; v_homeowner RECORD; v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id AND deleted_at IS NULL;
  IF v_job IS NULL THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_tenant_id IS NOT NULL AND (auth.jwt() ->> 'role') != 'superadmin' AND v_job.tenant_id != v_tenant_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO v_homeowner FROM homeowners WHERE id = v_job.homeowner_id AND deleted_at IS NULL;
  IF v_homeowner IS NULL THEN RAISE EXCEPTION 'Homeowner not found'; END IF;
  INSERT INTO invoices (tenant_id, homeowner_id, job_id, status, bill_to, notes, created_by)
  VALUES (v_job.tenant_id, v_job.homeowner_id, p_job_id, 'draft',
    jsonb_build_object('name', v_homeowner.full_name, 'email', v_homeowner.email, 'phone', v_homeowner.phone, 'address', v_homeowner.address),
    'Invoice for ' || v_job.title, NULLIF(auth.jwt() ->> 'user_id', '')::UUID) RETURNING id INTO v_invoice_id;
  IF p_include_line_items THEN
    INSERT INTO invoice_line_items (invoice_id, tenant_id, job_line_item_id, description, quantity, unit_price, unit, is_taxable, sort_order)
    SELECT v_invoice_id, v_job.tenant_id, jli.id, jli.description, jli.quantity, jli.unit_price, jli.unit, true, jli.sort_order FROM job_line_items jli WHERE jli.job_id = p_job_id;
  END IF;
  RETURN v_invoice_id;
END;
$$;

-- Get invoice by public token
CREATE OR REPLACE FUNCTION get_invoice_by_token(p_token TEXT)
RETURNS TABLE (id UUID, invoice_number TEXT, status invoice_status, invoice_date DATE, due_date DATE, subtotal NUMERIC, discount_amount NUMERIC, tax_amount NUMERIC, total NUMERIC, amount_paid NUMERIC, amount_due NUMERIC, bill_to JSONB, notes TEXT, stripe_hosted_url TEXT)
SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  UPDATE invoices SET viewed_at = COALESCE(viewed_at, NOW()), status = CASE WHEN status = 'sent' THEN 'viewed'::invoice_status ELSE status END WHERE public_token = p_token AND deleted_at IS NULL;
  RETURN QUERY SELECT i.id, i.invoice_number, i.status, i.invoice_date, i.due_date, i.subtotal, i.discount_amount, i.tax_amount, i.total, i.amount_paid, i.amount_due, i.bill_to, i.notes, i.stripe_hosted_url FROM invoices i WHERE i.public_token = p_token AND i.deleted_at IS NULL;
END;
$$;

-- Get invoice line items by token
CREATE OR REPLACE FUNCTION get_invoice_line_items_by_token(p_token TEXT)
RETURNS TABLE (id UUID, description TEXT, quantity NUMERIC, unit_price NUMERIC, unit TEXT, line_total NUMERIC, is_taxable BOOLEAN)
SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE v_invoice_id UUID;
BEGIN
  SELECT i.id INTO v_invoice_id FROM invoices i WHERE i.public_token = p_token AND i.deleted_at IS NULL;
  IF v_invoice_id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT ili.id, ili.description, ili.quantity, ili.unit_price, ili.unit, ili.line_total, ili.is_taxable FROM invoice_line_items ili WHERE ili.invoice_id = v_invoice_id ORDER BY ili.sort_order;
END;
$$;

-- UPGRADED: Record payment with job tenant validation
CREATE OR REPLACE FUNCTION record_payment(p_homeowner_id UUID, p_amount NUMERIC, p_method_type payment_method_type, p_invoice_id UUID DEFAULT NULL, p_job_id UUID DEFAULT NULL, p_type payment_type DEFAULT 'final', p_stripe_payment_intent_id TEXT DEFAULT NULL, p_check_number TEXT DEFAULT NULL, p_description TEXT DEFAULT NULL)
RETURNS UUID SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE v_payment_id UUID; v_tenant_id UUID; v_homeowner RECORD;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  SELECT * INTO v_homeowner FROM homeowners WHERE id = p_homeowner_id AND deleted_at IS NULL;
  IF v_homeowner IS NULL THEN RAISE EXCEPTION 'Homeowner not found'; END IF;
  IF v_tenant_id IS NOT NULL AND (auth.jwt() ->> 'role') != 'superadmin' AND v_homeowner.tenant_id != v_tenant_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  -- UPGRADED: Validate job belongs to same tenant
  IF p_job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jobs WHERE id = p_job_id AND tenant_id = v_homeowner.tenant_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Unauthorized job_id';
  END IF;
  INSERT INTO payments (tenant_id, homeowner_id, invoice_id, job_id, type, status, amount, method_type, stripe_payment_intent_id, check_number, description, created_by)
  VALUES (v_homeowner.tenant_id, p_homeowner_id, p_invoice_id, p_job_id, p_type,
    CASE WHEN p_stripe_payment_intent_id IS NOT NULL THEN 'processing' WHEN p_method_type IN ('check', 'cash') THEN 'succeeded' ELSE 'pending' END,
    p_amount, p_method_type, p_stripe_payment_intent_id, p_check_number, p_description, NULLIF(auth.jwt() ->> 'user_id', '')::UUID) RETURNING id INTO v_payment_id;
  INSERT INTO payment_events (payment_id, tenant_id, event_type, description, performed_by, performed_by_system)
  VALUES (v_payment_id, v_homeowner.tenant_id, 'created', 'Payment of $' || p_amount || ' recorded', NULLIF(auth.jwt() ->> 'user_id', '')::UUID, auth.jwt() IS NULL);
  RETURN v_payment_id;
END;
$$;

-- UPGRADED: Process refund with pre-check validation
CREATE OR REPLACE FUNCTION process_refund(p_payment_id UUID, p_amount NUMERIC, p_reason TEXT DEFAULT NULL)
RETURNS UUID SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE v_refund_id UUID; v_payment RECORD; v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id AND deleted_at IS NULL;
  IF v_payment IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_tenant_id IS NOT NULL AND (auth.jwt() ->> 'role') != 'superadmin' AND v_payment.tenant_id != v_tenant_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF v_payment.status != 'succeeded' THEN RAISE EXCEPTION 'Can only refund succeeded payments'; END IF;
  -- UPGRADED: Pre-check refundable amount BEFORE creating entry
  IF p_amount > v_payment.refundable_amount THEN RAISE EXCEPTION 'Refund amount exceeds refundable amount'; END IF;
  INSERT INTO payments (tenant_id, homeowner_id, invoice_id, job_id, type, status, amount, method_type, description, created_by)
  VALUES (v_payment.tenant_id, v_payment.homeowner_id, v_payment.invoice_id, v_payment.job_id, 'refund', 'succeeded', -p_amount, v_payment.method_type, COALESCE(p_reason, 'Refund for payment ' || v_payment.payment_number), NULLIF(auth.jwt() ->> 'user_id', '')::UUID) RETURNING id INTO v_refund_id;
  UPDATE payments SET refunded_amount = refunded_amount + p_amount, status = CASE WHEN refunded_amount + p_amount >= amount THEN 'refunded'::payment_status ELSE 'partially_refunded'::payment_status END WHERE id = p_payment_id;
  RETURN v_refund_id;
END;
$$;

-- Create installer payout
CREATE OR REPLACE FUNCTION create_installer_payout(p_installer_id UUID, p_job_ids UUID[], p_payout_method TEXT DEFAULT 'direct_deposit')
RETURNS UUID SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE v_payout_id UUID; v_installer RECORD; v_tenant_id UUID; v_total NUMERIC := 0; v_job RECORD;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  SELECT * INTO v_installer FROM installers WHERE id = p_installer_id AND deleted_at IS NULL;
  IF v_installer IS NULL THEN RAISE EXCEPTION 'Installer not found'; END IF;
  IF v_tenant_id IS NOT NULL AND (auth.jwt() ->> 'role') != 'superadmin' AND v_installer.tenant_id != v_tenant_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO payouts (tenant_id, installer_id, recipient_type, recipient_name, type, status, gross_amount, payout_method, created_by)
  VALUES (v_installer.tenant_id, p_installer_id, 'installer', v_installer.name, 'job_payment', 'pending', 0, p_payout_method, NULLIF(auth.jwt() ->> 'user_id', '')::UUID) RETURNING id INTO v_payout_id;
  FOR v_job IN SELECT * FROM jobs WHERE id = ANY(p_job_ids) AND installer_id = p_installer_id AND deleted_at IS NULL AND payout_status = 'pending' LOOP
    INSERT INTO payout_items (payout_id, tenant_id, job_id, type, description, amount) VALUES (v_payout_id, v_installer.tenant_id, v_job.id, 'job_payment', 'Payment for job ' || v_job.job_number, COALESCE(v_job.installer_payout, 0));
    v_total := v_total + COALESCE(v_job.installer_payout, 0);
    UPDATE jobs SET payout_status = 'approved' WHERE id = v_job.id;
  END LOOP;
  UPDATE payouts SET gross_amount = v_total WHERE id = v_payout_id;
  RETURN v_payout_id;
END;
$$;

-- Approve payout
CREATE OR REPLACE FUNCTION approve_payout(p_payout_id UUID)
RETURNS BOOLEAN SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE v_payout RECORD; v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  SELECT * INTO v_payout FROM payouts WHERE id = p_payout_id AND deleted_at IS NULL;
  IF v_payout IS NULL THEN RAISE EXCEPTION 'Payout not found'; END IF;
  IF v_tenant_id IS NOT NULL AND (auth.jwt() ->> 'role') != 'superadmin' AND v_payout.tenant_id != v_tenant_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF v_payout.status != 'pending' THEN RAISE EXCEPTION 'Payout is not pending'; END IF;
  UPDATE payouts SET status = 'approved', approved_by = NULLIF(auth.jwt() ->> 'user_id', '')::UUID, approved_at = NOW() WHERE id = p_payout_id;
  RETURN TRUE;
END;
$$;

-- UPGRADED: Create ledger transaction with debit/credit pre-check
CREATE OR REPLACE FUNCTION create_ledger_transaction(p_entries JSONB, p_payment_id UUID DEFAULT NULL, p_payout_id UUID DEFAULT NULL, p_invoice_id UUID DEFAULT NULL, p_job_id UUID DEFAULT NULL)
RETURNS UUID SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE v_transaction_id UUID; v_tenant_id UUID; v_entry JSONB; v_account_id UUID; v_total_debits NUMERIC := 0; v_total_credits NUMERIC := 0;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  v_transaction_id := uuid_generate_v4();
  -- UPGRADED: Pre-check for at least one debit and one credit
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_entries) elem WHERE elem->>'type' = 'debit') OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_entries) elem WHERE elem->>'type' = 'credit') THEN
    RAISE EXCEPTION 'Ledger transaction must contain at least one debit and one credit';
  END IF;
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries) LOOP
    SELECT id INTO v_account_id FROM ledger_accounts WHERE (tenant_id = v_tenant_id OR tenant_id IS NULL) AND code = v_entry->>'account_code' AND is_active = true;
    IF v_account_id IS NULL THEN RAISE EXCEPTION 'Account not found: %', v_entry->>'account_code'; END IF;
    IF (v_entry->>'type') = 'debit' THEN v_total_debits := v_total_debits + (v_entry->>'amount')::NUMERIC;
    ELSE v_total_credits := v_total_credits + (v_entry->>'amount')::NUMERIC; END IF;
    INSERT INTO ledger_entries (transaction_id, tenant_id, account_id, type, amount, description, payment_id, payout_id, invoice_id, job_id, created_by)
    VALUES (v_transaction_id, v_tenant_id, v_account_id, (v_entry->>'type')::ledger_entry_type, (v_entry->>'amount')::NUMERIC, v_entry->>'description', p_payment_id, p_payout_id, p_invoice_id, p_job_id, NULLIF(auth.jwt() ->> 'user_id', '')::UUID);
    UPDATE ledger_accounts SET current_balance = current_balance + CASE WHEN (v_entry->>'type') = 'debit' THEN (v_entry->>'amount')::NUMERIC ELSE -(v_entry->>'amount')::NUMERIC END WHERE id = v_account_id;
  END LOOP;
  IF v_total_debits != v_total_credits THEN RAISE EXCEPTION 'Debits (%) must equal credits (%)', v_total_debits, v_total_credits; END IF;
  RETURN v_transaction_id;
END;
$$;

-- Get payment summary
CREATE OR REPLACE FUNCTION get_payment_summary(p_start_date DATE DEFAULT NULL, p_end_date DATE DEFAULT NULL)
RETURNS TABLE (total_revenue NUMERIC, total_collected NUMERIC, total_pending NUMERIC, total_refunded NUMERIC, total_disputed NUMERIC, payment_count BIGINT, average_payment NUMERIC)
SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  RETURN QUERY SELECT 
    COALESCE(SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'succeeded' THEN net_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(refunded_amount), 0),
    COALESCE(SUM(CASE WHEN status = 'disputed' THEN amount ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE status = 'succeeded'),
    COALESCE(AVG(amount) FILTER (WHERE status = 'succeeded'), 0)
  FROM payments WHERE tenant_id = v_tenant_id AND deleted_at IS NULL AND type != 'refund' AND (p_start_date IS NULL OR created_at >= p_start_date) AND (p_end_date IS NULL OR created_at < p_end_date + INTERVAL '1 day');
END;
$$;

-- Get outstanding invoices
CREATE OR REPLACE FUNCTION get_outstanding_invoices(p_limit INT DEFAULT 50)
RETURNS TABLE (invoice_id UUID, invoice_number TEXT, homeowner_name TEXT, status invoice_status, total NUMERIC, amount_due NUMERIC, due_date DATE, days_overdue INT, job_number TEXT)
SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  RETURN QUERY SELECT i.id, i.invoice_number, h.full_name, i.status, i.total, i.amount_due, i.due_date,
    CASE WHEN i.due_date < CURRENT_DATE THEN (CURRENT_DATE - i.due_date)::INT ELSE 0 END, j.job_number
  FROM invoices i JOIN homeowners h ON h.id = i.homeowner_id LEFT JOIN jobs j ON j.id = i.job_id
  WHERE i.tenant_id = v_tenant_id AND i.deleted_at IS NULL AND i.status IN ('sent', 'viewed', 'partial', 'overdue') AND i.amount_due > 0
  ORDER BY CASE WHEN i.due_date < CURRENT_DATE THEN 0 ELSE 1 END, i.due_date LIMIT p_limit;
END;
$$;

-- Get pending payouts
CREATE OR REPLACE FUNCTION get_pending_payouts(p_limit INT DEFAULT 50)
RETURNS TABLE (payout_id UUID, payout_number TEXT, recipient_name TEXT, recipient_type TEXT, type payout_type, status payout_status, net_amount NUMERIC, item_count BIGINT, created_at TIMESTAMPTZ)
SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  RETURN QUERY SELECT p.id, p.payout_number, p.recipient_name, p.recipient_type, p.type, p.status, p.net_amount, COUNT(pi.id), p.created_at
  FROM payouts p LEFT JOIN payout_items pi ON pi.payout_id = p.id
  WHERE p.tenant_id = v_tenant_id AND p.deleted_at IS NULL AND p.status IN ('pending', 'approved')
  GROUP BY p.id ORDER BY p.created_at LIMIT p_limit;
END;
$$;
