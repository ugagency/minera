import type { ExpenseCategory, PaymentMethod, ReceiptMethod, Role } from "./data/types";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  diesel: "Diesel",
  part_service: "Peça/Serviço",
  labor: "Mão de obra",
  freight: "Frete",
  other: "Outro",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  credit: "Fiado",
};

export const RECEIPT_METHOD_LABELS: Record<ReceiptMethod, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  transfer: "Transferência",
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Dono",
  office: "Escritório",
  field: "Campo",
};
