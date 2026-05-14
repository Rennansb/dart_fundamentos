export interface Customer {
  id: string;
  companyId: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  address: string;
  cep?: string;
  createdAt?: any;
}

export interface Vehicle {
  id: string;
  companyId: string;
  customerId: string;
  brand: string;
  model: string;
  year: string;
  plate: string;
  createdAt?: any;
}

export interface PartItem {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  brand?: string;
  model?: string;
  year?: string;
  color?: string;
  photoURL?: string;
  productURL?: string;
  supplierId?: string;
  supplierName?: string;
}

export interface Quote {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  customerCpf?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  vehicleId?: string | null;
  vehicleInfo?: string | null;
  employeeId?: string;
  employeeName?: string;
  parts: PartItem[];
  laborPrice?: number;
  total: number;
  status: 'pending' | 'approved' | 'rejected' | string;
  createdAt?: any;
}

export interface WorkOrder {
  id: string;
  companyId: string;
  quoteId?: string;
  customerId: string;
  customerName: string;
  vehicleId?: string;
  vehicleInfo?: string;
  status: 'waiting_payment' | 'payment_received' | 'awaiting_parts' | 'repair_started' | 'in_repair' | 'Pendente de Peças' | 'completed' | 'service_finished' | 'delivered';
  totalCost: number;
  paidAmount?: number;
  remainingAmount?: number;
  laborCost?: number;
  partsCost?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface Expense {
  id: string;
  companyId: string;
  description?: string;
  amount: number;
  category?: string;
  date?: any;
  createdAt?: any;
}

export interface InventoryItem {
  id: string;
  companyId: string;
  name: string;
  quantity: number;
  minQuantity?: number;
  price?: number;
}
