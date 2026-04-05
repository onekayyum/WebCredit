const NS_PER_DAY = 24n * 3600n * 1000000000n;
const MAX_NAME_LENGTH = 200;

function nowNs() {
  return (BigInt(Date.now()) * 1000000n).toString();
}

function validateSignupPayload(payload) {
  const username = String(payload?.username ?? "").trim();
  const password = String(payload?.password ?? "");

  if (username.length < 3 || username.length > 50) {
    return { ok: false, error: "username must be between 3 and 50 characters" };
  }
  if (password.length < 8 || password.length > 128) {
    return { ok: false, error: "password must be between 8 and 128 characters" };
  }

  return { ok: true, username, password };
}

function validateProductRow(input) {
  const name = String(input?.name ?? "").trim();
  const barcode = String(input?.barcode ?? "").trim();
  const price = Number(input?.price);

  if (
    !name ||
    name.length > MAX_NAME_LENGTH ||
    !barcode ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return null;
  }

  return { name, price, barcode };
}

function validateCustomerInput(input) {
  const name = String(input?.name ?? "").trim();
  const mobile = String(input?.mobile ?? "").trim();

  if (!name || name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: "name is required and must be under 200 characters" };
  }
  if (!mobile || mobile.length > 20) {
    return { ok: false, error: "mobile is required and must be under 20 characters" };
  }

  return { ok: true, name, mobile };
}

function validateTransactionInput(input) {
  const customerId = Number(input?.customerId);
  const productName = String(input?.productName ?? "").trim();
  const note = String(input?.note ?? "").trim();
  const amount = Number(input?.amount);
  const txType = String(input?.txType ?? "").trim();

  if (!Number.isFinite(customerId) || customerId <= 0) {
    return { ok: false, error: "valid customerId is required" };
  }
  if (!productName) {
    return { ok: false, error: "productName is required" };
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: "valid amount is required" };
  }
  if (txType !== "udhaar" && txType !== "payment") {
    return { ok: false, error: "txType must be 'udhaar' or 'payment'" };
  }

  return { ok: true, customerId, productName, note, amount, txType };
}

const rowCustomer = (c) => ({
  id: String(c.id),
  name: c.name,
  mobile: c.mobile,
  createdAt: String(c.createdAt),
});

const rowProduct = (p) => ({
  id: String(p.id),
  name: p.name,
  price: p.price,
  barcode: p.barcode,
  createdAt: String(p.createdAt),
});

const rowTransaction = (t) => ({
  id: String(t.id),
  customerId: String(t.customerId),
  productName: t.productName,
  note: t.note,
  amount: t.amount,
  txType: t.txType,
  timestamp: String(t.timestamp),
  itemsJson: t.itemsJson ?? null,
});

export {
  NS_PER_DAY,
  MAX_NAME_LENGTH,
  nowNs,
  validateSignupPayload,
  validateProductRow,
  validateCustomerInput,
  validateTransactionInput,
  rowCustomer,
  rowProduct,
  rowTransaction,
};
