import React, { useEffect, useState } from "react";

const API_BASE =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_API_URL ||
  "http://127.0.0.1:8001";

export default function MiniBasketAgentPortal() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [legal, setLegal] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [prodForm, setProdForm] = useState({
    name: "",
    category: "Fruits",
    store_price: 120,
    delivery_charge: 35,
    unit: "1 kg",
    stock: 25,
    local_store_name: "Local Kirana Store",
  });

  async function loadAll() {
    try {
      const [pRes, oRes, lRes] = await Promise.all([
        fetch(`${API_BASE}/api/minibasket/products`),
        fetch(`${API_BASE}/api/minibasket/agent/orders`),
        fetch(`${API_BASE}/api/minibasket/legal`),
      ]);
      if (pRes.ok) {
        const pData = await pRes.json();
        setProducts(pData.products || []);
      }
      if (oRes.ok) {
        const oData = await oRes.json();
        setOrders(oData.orders || []);
      }
      if (lRes.ok) {
        setLegal(await lRes.json());
      }
    } catch (err) {
      setStatusMsg(`Failed to load MiniBasket data: ${err.message}`);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleSaveProduct(e) {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/api/minibasket/agent/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...prodForm,
        store_price: Number(prodForm.store_price),
        delivery_charge: Number(prodForm.delivery_charge),
        stock: Number(prodForm.stock),
        in_stock: Number(prodForm.stock) > 0,
      }),
    });
    const data = await res.json();
    setStatusMsg(data.message || "Product updated");
    setProdForm({ ...prodForm, name: "" });
    loadAll();
  }

  async function handleStatusChange(orderId, status) {
    const res = await fetch(`${API_BASE}/api/minibasket/agent/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    setStatusMsg(data.message || "Order updated");
    loadAll();
  }

  async function handleCancelOrder(orderId) {
    const res = await fetch(`${API_BASE}/api/minibasket/orders/${orderId}/cancel`, {
      method: "POST",
    });
    const data = await res.json();
    setStatusMsg(data.message || "Order cancelled");
    loadAll();
  }

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 1100, margin: "0 auto" }}>
      <h1>MiniBasket — Delivery Agent & Order Fulfillment Console</h1>
      {statusMsg && <p style={{ background: "#eef6ff", padding: 10 }}><strong>Status:</strong> {statusMsg}</p>}

      <h2>1. Add / Update Product, Store Price & Delivery Fee (₹30–₹40)</h2>
      <form onSubmit={handleSaveProduct} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <input placeholder="Item name" value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} required />
        <input placeholder="Category" value={prodForm.category} onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })} required />
        <input type="number" step="0.5" placeholder="Store price" value={prodForm.store_price} onChange={(e) => setProdForm({ ...prodForm, store_price: e.target.value })} required />
        <input type="number" min="30" max="40" placeholder="Delivery fee (30-40)" value={prodForm.delivery_charge} onChange={(e) => setProdForm({ ...prodForm, delivery_charge: e.target.value })} required />
        <input placeholder="Unit" value={prodForm.unit} onChange={(e) => setProdForm({ ...prodForm, unit: e.target.value })} />
        <input type="number" min="0" placeholder="Stock" value={prodForm.stock} onChange={(e) => setProdForm({ ...prodForm, stock: e.target.value })} required />
        <input placeholder="Local store" value={prodForm.local_store_name} onChange={(e) => setProdForm({ ...prodForm, local_store_name: e.target.value })} />
        <button type="submit">Save Product</button>
      </form>

      <h3>Live Products ({products.length})</h3>
      <table border="1" cellPadding="6" cellSpacing="0" width="100%" style={{ marginBottom: 24 }}>
        <thead>
          <tr>
            <th>Item</th>
            <th>Store Price</th>
            <th>Delivery Fee</th>
            <th>Total Unit Price</th>
            <th>Stock</th>
            <th>Store</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>₹{p.store_price}</td>
              <td>₹{p.delivery_charge}</td>
              <td><strong>₹{p.total_unit_price}</strong></td>
              <td>{p.stock}</td>
              <td>{p.local_store_name || "Local Store"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>2. Prepaid Orders (Next-Day Evening Delivery & 10:00 AM Cancellation Rule)</h2>
      {orders.map((o) => (
        <div key={o.id} style={{ border: "1px solid #ccc", padding: 12, marginBottom: 12 }}>
          <p><strong>Order:</strong> {o.id} | <strong>Status:</strong> {o.status} | <strong>Paid:</strong> ₹{o.paid_amount} ({o.payment_status})</p>
          <p><strong>Customer:</strong> {o.customer?.name} | <strong>Email:</strong> {o.customer?.email} | <strong>Phone:</strong> {o.customer?.phone}</p>
          <p><strong>Address:</strong> {o.customer?.delivery_address}</p>
          <p><strong>Delivery Window:</strong> {o.schedule?.delivery_slot} ({o.schedule?.delivery_date_ist}) | <strong>Cancel Cutoff:</strong> 10:00 AM IST on delivery day</p>
          {o.refund_info && <p><strong>Refund:</strong> ₹{o.refund_info.refund_amount} (Penalty: ₹{o.refund_info.penalty_amount}) — {o.refund_info.refund_reason}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => handleStatusChange(o.id, "SHOPPING_AT_LOCAL_STORE")}>Mark Store Shopping</button>
            <button onClick={() => handleStatusChange(o.id, "OUT_FOR_EVENING_DELIVERY")}>Out for Evening Delivery</button>
            <button onClick={() => handleStatusChange(o.id, "DELIVERED")}>Mark Delivered</button>
            {o.status !== "CANCELLED" && <button onClick={() => handleCancelOrder(o.id)}>Cancel & Compute Refund</button>}
          </div>
        </div>
      ))}

      {legal && (
        <>
          <h2>3. Terms, Privacy, Refund & Missing/Out-of-Stock Policies</h2>
          <p><strong>Terms & Conditions:</strong> {legal.terms_and_conditions}</p>
          <p><strong>Privacy Policy:</strong> {legal.privacy_policy}</p>
          <p><strong>Refund & Cancellation:</strong> {legal.refund_and_cancellation_policy?.before_10am} {legal.refund_and_cancellation_policy?.after_10am}</p>
          <p><strong>Missing / Out-of-Stock Policy:</strong> {legal.missing_or_out_of_stock_policy}</p>
        </>
      )}
    </div>
  );
}
