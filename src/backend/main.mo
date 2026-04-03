import Text "mo:core/Text";
import Float "mo:core/Float";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Order "mo:core/Order";
import Iter "mo:core/Iter";
import Map "mo:core/Map";



actor {
  type Customer = {
    id : Nat;
    name : Text;
    mobile : Text;
    createdAt : Int;
  };

  module Customer {
    public func compare(c1 : Customer, c2 : Customer) : Order.Order {
      Nat.compare(c1.id, c2.id);
    };
  };

  type Product = {
    id : Nat;
    name : Text;
    price : Float;
    barcode : Text;
    createdAt : Int;
  };

  module Product {
    public func compare(p1 : Product, p2 : Product) : Order.Order {
      Nat.compare(p1.id, p2.id);
    };
  };

  type Transaction = {
    id : Nat;
    customerId : Nat;
    productName : Text;
    note : Text;
    amount : Float;
    txType : Text;
    timestamp : Int;
    itemsJson : ?Text;
  };

  // ============================================================
  // BACKEND IS LOCKED -- DO NOT REGENERATE THIS FILE.
  // DO NOT call generate_motoko_code for this project.
  // Only the frontend should be updated in future builds.
  //
  // CRITICAL: This Transaction module MUST stay here.
  // Motoko uses it as an implicit comparator for .sort() on
  // [Transaction] arrays. If this module is removed, .sort()
  // will fail to compile and ALL data loading will break.
  // DO NOT REMOVE OR RENAME THIS MODULE.
  // ============================================================
  module Transaction {
    public func compare(t1 : Transaction, t2 : Transaction) : Order.Order {
      Int.compare(t1.timestamp, t2.timestamp);
    };
  };

  type CustomerBalance = {
    totalUdhaar : Float;
    totalPaid : Float;
    remainingBalance : Float;
    lastPaymentDate : Int;
    customer : Customer;
  };

  module ProductSearch {
    public func compareById(p1 : Product, p2 : Product) : Order.Order {
      Nat.compare(p1.id, p2.id);
    };
  };

  var nextCustomerId = 1;
  var nextProductId = 1;
  var nextTransactionId = 1;

  let customers = Map.empty<Nat, Customer>();
  let products = Map.empty<Nat, Product>();
  let transactions = Map.empty<Nat, Transaction>();

  // Customer Management
  public shared func addCustomer(name : Text, mobile : Text) : async ?Customer {
    if (mobile.size() == 0) {
      return null;
    };

    let mobileExists = customers.values().any(func(c) { c.mobile == mobile });
    if (mobileExists) {
      return null;
    };

    let customer : Customer = {
      id = nextCustomerId;
      name;
      mobile;
      createdAt = Time.now();
    };

    customers.add(nextCustomerId, customer);
    nextCustomerId += 1;
    ?customer;
  };

  public shared func updateCustomer(id : Nat, name : Text, mobile : Text) : async Bool {
    if (mobile.size() == 0) { return false };

    let mobileExists = customers.values().any(func(c) { c.mobile == mobile and c.id != id });
    if (mobileExists) {
      return false;
    };

    switch (customers.get(id)) {
      case (null) { false };
      case (?existing) {
        let newCustomer : Customer = {
          id = existing.id;
          name;
          mobile;
          createdAt = existing.createdAt;
        };
        customers.add(id, newCustomer);
        true;
      };
    };
  };

  public shared func deleteCustomer(id : Nat) : async Bool {
    if (not customers.containsKey(id)) { return false };
    customers.remove(id);
    true;
  };

  public query func getAllCustomers() : async [CustomerBalance] {
    customers.values().map(getCustomerBalance).toArray();
  };

  public query func searchCustomers(term : Text) : async [Customer] {
    customers.values().filter(func(c) { c.name.contains(#text term) or c.mobile.contains(#text term) }).toArray();
  };

  // Product Management
  public shared func addProduct(name : Text, price : Float, barcode : Text) : async ?Product {
    let barcodeExists = products.values().any(func(p) { p.barcode == barcode });
    if (barcodeExists) {
      return null;
    };

    let product : Product = {
      id = nextProductId;
      name;
      price;
      barcode;
      createdAt = Time.now();
    };

    products.add(nextProductId, product);
    nextProductId += 1;
    ?product;
  };

  public shared func updateProduct(id : Nat, name : Text, price : Float, barcode : Text) : async Bool {
    switch (products.get(id)) {
      case (null) { false };
      case (?existing) {
        let newProduct : Product = {
          id = existing.id;
          name;
          price;
          barcode;
          createdAt = existing.createdAt;
        };
        products.add(id, newProduct);
        true;
      };
    };
  };

  public shared func deleteProduct(id : Nat) : async Bool {
    if (not products.containsKey(id)) { return false };
    products.remove(id);
    true;
  };

  public query func getAllProducts() : async [Product] {
    products.values().toArray();
  };

  public shared func bulkImportProducts(productList : [Product]) : async (Nat, Nat) {
    var added = 0;
    var skipped = 0;
    for (product in productList.values()) {
      let barcodeExists = products.values().any(func(p) { p.barcode == product.barcode });
      if (not barcodeExists) {
        let newProduct : Product = {
          id = nextProductId;
          name = product.name;
          price = product.price;
          barcode = product.barcode;
          createdAt = Time.now();
        };
        products.add(nextProductId, newProduct);
        nextProductId += 1;
        added += 1;
      } else {
        skipped += 1;
      };
    };
    (added, skipped);
  };

  public query func searchProducts(term : Text) : async [Product] {
    let filteredProducts = products.values().filter(func(p) { p.name.contains(#text term) or p.barcode.contains(#text term) });
    filteredProducts.toArray().sort(ProductSearch.compareById);
  };

  // Transaction Management
  public shared func addTransaction(customerId : Nat, productName : Text, note : Text, amount : Float, txType : Text) : async ?Transaction {
    switch (customers.get(customerId)) {
      case (null) { null };
      case (_) {
        let transaction : Transaction = {
          id = nextTransactionId;
          customerId;
          productName;
          note;
          amount;
          txType;
          timestamp = Time.now();
          itemsJson = null;
        };
        transactions.add(nextTransactionId, transaction);
        nextTransactionId += 1;
        ?transaction;
      };
    };
  };

  public shared func addBatchTransaction(customerId : Nat, totalAmount : Float, itemsJson : Text, note : Text) : async ?Transaction {
    switch (customers.get(customerId)) {
      case (null) { null };
      case (_) {
        let transaction : Transaction = {
          id = nextTransactionId;
          customerId;
          productName = "Batch";
          note;
          amount = totalAmount;
          txType = "udhaar";
          timestamp = Time.now();
          itemsJson = ?itemsJson;
        };
        transactions.add(nextTransactionId, transaction);
        nextTransactionId += 1;
        ?transaction;
      };
    };
  };

  public shared func deleteTransaction(id : Nat) : async Bool {
    if (not transactions.containsKey(id)) { return false };
    transactions.remove(id);
    true;
  };

  // NOTE: .sort() here uses Transaction.compare IMPLICITLY (inferred from
  // the Transaction module above). Do NOT pass it explicitly and do NOT
  // remove the Transaction module -- either will break compilation.
  public query func getTransactionsForCustomer(customerId : Nat) : async [Transaction] {
    transactions.values().filter(func(t) { t.customerId == customerId }).toArray().sort();
  };

  // Balance and Summary Functions
  func getCustomerBalance(customer : Customer) : CustomerBalance {
    var totalUdhaar = 0.0;
    var totalPaid = 0.0;
    var lastPaymentDate : Int = 0;

    for (transaction in transactions.values()) {
      if (transaction.customerId == customer.id) {
        if (transaction.txType == "udhaar") {
          totalUdhaar += transaction.amount;
        } else if (transaction.txType == "payment") {
          totalPaid += transaction.amount;
          if (transaction.timestamp > lastPaymentDate) {
            lastPaymentDate := transaction.timestamp;
          };
        };
      };
    };

    {
      totalUdhaar;
      totalPaid;
      remainingBalance = totalUdhaar - totalPaid;
      lastPaymentDate;
      customer;
    };
  };

  public query func getCustomerBalanceSummary(customerId : Nat) : async ?CustomerBalance {
    let customer = customers.get(customerId);
    switch (customer) {
      case (null) { null };
      case (?c) { ?getCustomerBalance(c) };
    };
  };

  public query func getCustomersSortedByBalance() : async [CustomerBalance] {
    customers.values().map(getCustomerBalance).toArray().sort(
      func(a, b) { Float.compare(b.remainingBalance, a.remainingBalance) }
    );
  };

  public query func getHighBalanceCustomers(threshold : Float) : async [CustomerBalance] {
    customers.values().map(getCustomerBalance).filter(
      func(cb) { cb.remainingBalance > threshold }
    ).toArray();
  };

  public query func getInactiveCustomers(days : Int) : async [CustomerBalance] {
    let now = Time.now();
    let filteredCustomers = customers.values().map(getCustomerBalance).filter(
      func(cb) {
        let daysSincePayment = if (cb.lastPaymentDate == 0) {
          days + 1;
        } else {
          (now - cb.lastPaymentDate) / (24 * 3600 * 1000000000);
        };
        daysSincePayment > days;
      }
    );
    filteredCustomers.toArray();
  };
};
