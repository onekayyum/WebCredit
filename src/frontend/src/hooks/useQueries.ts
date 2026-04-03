import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CustomerBalance, Product, Transaction } from "../backend.d";
import { useActor } from "./useActor";

export function useAllCustomers() {
  const { actor, isFetching } = useActor();
  return useQuery<CustomerBalance[]>({
    queryKey: ["customers"],
    queryFn: () => actor!.getAllCustomers(),
    enabled: !!actor && !isFetching,
  });
}

export function useCustomerBalance(customerId: bigint) {
  const { actor, isFetching } = useActor();
  return useQuery<CustomerBalance | null>({
    queryKey: ["customerBalance", customerId.toString()],
    queryFn: () => actor!.getCustomerBalanceSummary(customerId),
    enabled: !!actor && !isFetching,
  });
}

export function useTransactions(customerId: bigint) {
  const { actor, isFetching } = useActor();
  return useQuery<Transaction[]>({
    queryKey: ["transactions", customerId.toString()],
    queryFn: () => actor!.getTransactionsForCustomer(customerId),
    enabled: !!actor && !isFetching,
  });
}

export function useAllProducts() {
  const { actor, isFetching } = useActor();
  return useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => actor!.getAllProducts(),
    enabled: !!actor && !isFetching,
  });
}

export function useAddCustomer() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, mobile }: { name: string; mobile: string }) =>
      actor!.addCustomer(name, mobile),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      name,
      mobile,
    }: { id: bigint; name: string; mobile: string }) =>
      actor!.updateCustomer(id, name, mobile),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useDeleteCustomer() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: bigint) => actor!.deleteCustomer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useAddTransaction() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      customerId,
      productName,
      note,
      amount,
      txType,
    }: {
      customerId: bigint;
      productName: string;
      note: string;
      amount: number;
      txType: string;
    }) => actor!.addTransaction(customerId, productName, note, amount, txType),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["transactions", variables.customerId.toString()],
      });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({
        queryKey: ["customerBalance", variables.customerId.toString()],
      });
    },
  });
}

export function useAddBatchTransaction() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      customerId,
      totalAmount,
      itemsJson,
      note,
    }: {
      customerId: bigint;
      totalAmount: number;
      itemsJson: string;
      note: string;
    }) => actor!.addBatchTransaction(customerId, totalAmount, itemsJson, note),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["transactions", variables.customerId.toString()],
      });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({
        queryKey: ["customerBalance", variables.customerId.toString()],
      });
    },
  });
}

export function useDeleteTransaction() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: bigint) => actor!.deleteTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useAddProduct() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      price,
      barcode,
    }: { name: string; price: number; barcode: string }) =>
      actor!.addProduct(name, price, barcode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      name,
      price,
      barcode,
    }: {
      id: bigint;
      name: string;
      price: number;
      barcode: string;
    }) => actor!.updateProduct(id, name, price, barcode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: bigint) => actor!.deleteProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}
