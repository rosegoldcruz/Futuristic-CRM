"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import type { Lead, LeadCreate, LeadUpdate } from "@/lib/types";

type LeadPayload = {
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  source?: string;
  status?: string;
  internal_notes?: string;
};

const STATUS_OPTIONS = ["new", "contacted", "qualified", "won", "lost"];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editLeadId, setEditLeadId] = useState<number | null>(null);
  const [formData, setFormData] = useState<LeadPayload>({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    source: "",
    status: "new",
    internal_notes: "",
  });

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        !search ||
        lead.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        (lead.customer_email || "").toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        !statusFilter || (lead.status || "") === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [leads, search, statusFilter]);

  async function loadLeads() {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);

      const data = await apiGet<Lead[]>(`/leads?${params.toString()}`);
      setLeads(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreateForm() {
    setEditLeadId(null);
    setFormData({
      customer_name: "",
      customer_email: "",
      customer_phone: "",
      source: "",
      status: "new",
      internal_notes: "",
    });
    setFormOpen(true);
  }

  function openEditForm(lead: Lead) {
    setEditLeadId(lead.id);
    setFormData({
      customer_name: lead.customer_name,
      customer_email: lead.customer_email || "",
      customer_phone: lead.customer_phone || "",
      source: lead.source || "",
      status: lead.status || "new",
      internal_notes: lead.internal_notes || "",
    });
    setFormOpen(true);
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      if (!formData.customer_name) {
        setError("Name is required");
        return;
      }

      if (editLeadId) {
        await apiPut(`/leads/${editLeadId}`, formData);
      } else {
        await apiPost("/leads", formData);
      }

      setFormOpen(false);
      await loadLeads();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save lead");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this lead?")) return;
    try {
      setLoading(true);
      setError(null);
      await apiDelete(`/leads/${id}`);
      await loadLeads();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to delete lead");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-sm text-gray-500">
            Track inbound homeowners, campaign performance, and pipeline.
          </p>
        </div>

        <button
          onClick={openCreateForm}
          className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700"
        >
          + New Lead
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <button
          onClick={loadLeads}
          className="px-3 py-2 border rounded-lg text-sm bg-white hover:bg-gray-50"
        >
          Refresh
        </button>

        {loading && (
          <span className="text-xs text-gray-500">Loading…</span>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  No leads found.
                </td>
              </tr>
            )}
            {filteredLeads.map((lead) => (
              <tr key={lead.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {lead.customer_name}
                  </div>
                </td>
                <td className="px-4 py-3">{lead.customer_email || "—"}</td>
                <td className="px-4 py-3">{lead.customer_phone || "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {lead.source || "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700">
                    {lead.status || "new"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {lead.created_at ? new Date(lead.created_at).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => openEditForm(lead)}
                    className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(lead.id)}
                    className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editLeadId ? "Edit Lead" : "New Lead"}
              </h2>
              <button
                onClick={() => setFormOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="px-3 py-2 rounded bg-red-50 text-xs text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    name="customer_email"
                    type="email"
                    value={formData.customer_email}
                    onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    name="customer_phone"
                    value={formData.customer_phone}
                    onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Source
                  </label>
                  <input
                    name="source"
                    value={formData.source}
                    onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Meta, TikTok, Referral..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  name="internal_notes"
                  value={formData.internal_notes}
                  onChange={handleChange}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60"
                >
                  {editLeadId ? "Save Changes" : "Create Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
