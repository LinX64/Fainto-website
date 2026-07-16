/*
 * Fainto desktop viewer — sample data.
 *
 * A realistic FullDataExportBundle used only when viewer.html is opened directly
 * from the repository (the __FAINTO_DATA__ token has not been replaced by a real
 * export). Never loaded via fetch/XHR — see viewer.html's data-loading comment
 * for why this is a plain <script src> global assignment instead.
 *
 * Figures are illustrative Polish (PLN) amounts for a single fictitious user,
 * "Anna Kowalska", chosen to exercise every section of the viewer: multiple
 * months of transactions, a foreign-currency purchase, a transfer/refund/split/
 * CSV-import badge each, budgets in every status band, net worth with assets
 * and liabilities, a priced portfolio (including one foreign-currency holding),
 * unpriced crypto, subscriptions, recurring payments (including an archived
 * one), tracked debts (including credit-utilization), bill reminders, and a
 * short chat transcript containing deliberately hostile text to prove the
 * renderer never executes it.
 */
(function () {
  'use strict';

  function d(y, m, day, h, mi) {
    return Date.UTC(y, m - 1, day, h || 12, mi || 0, 0);
  }

  var tx = [];
  var tid = 0;
  function addTx(fields) {
    tid += 1;
    tx.push(Object.assign({
      id: 'tx' + String(tid).padStart(3, '0'),
      note: '',
      iconKey: null,
      foreignAmount: null,
      foreignCurrency: null,
      tags: [],
      receiptUri: null,
      splitOf: null,
      transferPeerId: null,
      refundOf: null,
      externalId: null,
      importSource: null,
    }, fields));
  }

  // February 2026
  addTx({ amount: 6885, type: 'INCOME', category: 'SALARY', note: 'Monthly salary', timestampMillis: d(2026, 2, 10, 9, 0) });
  addTx({ amount: 245.30, type: 'EXPENSE', category: 'FOOD', note: 'Weekly groceries', timestampMillis: d(2026, 2, 3, 18, 20) });
  addTx({ amount: 210.10, type: 'EXPENSE', category: 'FOOD', note: 'Weekly groceries', timestampMillis: d(2026, 2, 17, 18, 5) });
  addTx({ amount: 180, type: 'EXPENSE', category: 'TRANSPORT', note: 'Fuel', timestampMillis: d(2026, 2, 6, 8, 40) });
  addTx({ amount: 195, type: 'EXPENSE', category: 'UTILITIES', note: 'Electricity bill', timestampMillis: d(2026, 2, 14, 12, 0) });
  addTx({ amount: 65, type: 'EXPENSE', category: 'ENTERTAINMENT', note: 'Cinema', timestampMillis: d(2026, 2, 20, 20, 30) });
  addTx({ amount: 78, type: 'EXPENSE', category: 'HEALTH', note: 'Pharmacy', timestampMillis: d(2026, 2, 22, 17, 10) });

  // March 2026
  addTx({ amount: 6885, type: 'INCOME', category: 'SALARY', note: 'Monthly salary', timestampMillis: d(2026, 3, 10, 9, 0) });
  addTx({ amount: 260, type: 'EXPENSE', category: 'FOOD', note: 'Weekly groceries', timestampMillis: d(2026, 3, 4, 18, 15) });
  addTx({ amount: 230, type: 'EXPENSE', category: 'FOOD', note: 'Weekly groceries', timestampMillis: d(2026, 3, 18, 18, 0) });
  addTx({ amount: 195, type: 'EXPENSE', category: 'TRANSPORT', note: 'Fuel', timestampMillis: d(2026, 3, 9, 8, 30) });
  addTx({ amount: 205, type: 'EXPENSE', category: 'UTILITIES', note: 'Electricity bill', timestampMillis: d(2026, 3, 14, 12, 0) });
  addTx({ amount: 340, type: 'EXPENSE', category: 'SHOPPING', note: 'Winter jacket', timestampMillis: d(2026, 3, 21, 16, 45) });
  addTx({ amount: 500, type: 'EXPENSE', category: 'SAVINGS', note: 'Transfer to emergency fund', timestampMillis: d(2026, 3, 25, 10, 0), transferPeerId: 'tx-savings-leg-2' });
  addTx({ amount: 199, type: 'EXPENSE', category: 'EDUCATION', note: 'Online course: data analysis', timestampMillis: d(2026, 3, 28, 21, 0) });

  // April 2026
  addTx({ amount: 6885, type: 'INCOME', category: 'SALARY', note: 'Monthly salary', timestampMillis: d(2026, 4, 10, 9, 0) });
  addTx({ amount: 255, type: 'EXPENSE', category: 'FOOD', note: 'Weekly groceries', timestampMillis: d(2026, 4, 2, 18, 10) });
  addTx({ amount: 240, type: 'EXPENSE', category: 'FOOD', note: 'Weekly groceries', timestampMillis: d(2026, 4, 16, 18, 5) });
  addTx({ amount: 175, type: 'EXPENSE', category: 'TRANSPORT', note: 'Fuel', timestampMillis: d(2026, 4, 11, 8, 20) });
  addTx({ amount: 190, type: 'EXPENSE', category: 'UTILITIES', note: 'Electricity bill', timestampMillis: d(2026, 4, 14, 12, 0) });
  addTx({ amount: 220, type: 'EXPENSE', category: 'ENTERTAINMENT', note: 'Concert tickets', timestampMillis: d(2026, 4, 19, 19, 30) });
  addTx({ amount: 340, type: 'EXPENSE', category: 'HEALTH', note: 'Dentist', timestampMillis: d(2026, 4, 24, 11, 0) });
  addTx({ id: 'tx-shoes-1', amount: 189, type: 'EXPENSE', category: 'SHOPPING', note: 'New running shoes', timestampMillis: d(2026, 4, 5, 15, 0) });
  addTx({ amount: 189, type: 'INCOME', category: 'SHOPPING', note: 'Refund: running shoes (wrong size)', timestampMillis: d(2026, 4, 27, 14, 0), refundOf: 'tx-shoes-1' });

  // May 2026
  addTx({ amount: 6885, type: 'INCOME', category: 'SALARY', note: 'Monthly salary', timestampMillis: d(2026, 5, 10, 9, 0) });
  addTx({ amount: 265, type: 'EXPENSE', category: 'FOOD', note: 'Weekly groceries', timestampMillis: d(2026, 5, 5, 18, 10) });
  addTx({ amount: 250, type: 'EXPENSE', category: 'FOOD', note: 'Weekly groceries', timestampMillis: d(2026, 5, 19, 18, 0) });
  addTx({ amount: 185, type: 'EXPENSE', category: 'TRANSPORT', note: 'Fuel', timestampMillis: d(2026, 5, 12, 8, 35) });
  addTx({ amount: 200, type: 'EXPENSE', category: 'UTILITIES', note: 'Electricity bill', timestampMillis: d(2026, 5, 15, 12, 0) });
  addTx({ amount: 90, type: 'EXPENSE', category: 'ENTERTAINMENT', note: 'Streaming bundle top-up', timestampMillis: d(2026, 5, 21, 20, 0) });
  addTx({ amount: 150, type: 'EXPENSE', category: 'SHOPPING', note: 'Gym gear', timestampMillis: d(2026, 5, 24, 17, 30) });
  addTx({ amount: 80, type: 'EXPENSE', category: 'FOOD', note: 'My share of team dinner', timestampMillis: d(2026, 5, 8, 21, 0), splitOf: 'tx-dinner-1-parent' });

  // June 2026
  addTx({ amount: 6885, type: 'INCOME', category: 'SALARY', note: 'Monthly salary', timestampMillis: d(2026, 6, 10, 9, 0) });
  addTx({ amount: 270, type: 'EXPENSE', category: 'FOOD', note: 'Weekly groceries', timestampMillis: d(2026, 6, 3, 18, 15) });
  addTx({ amount: 255, type: 'EXPENSE', category: 'FOOD', note: 'Weekly groceries', timestampMillis: d(2026, 6, 17, 18, 5) });
  addTx({ amount: 190, type: 'EXPENSE', category: 'TRANSPORT', note: 'Fuel', timestampMillis: d(2026, 6, 9, 8, 25) });
  addTx({ amount: 210, type: 'EXPENSE', category: 'UTILITIES', note: 'Electricity bill', timestampMillis: d(2026, 6, 14, 12, 0) });
  addTx({ amount: 260, type: 'EXPENSE', category: 'ENTERTAINMENT', note: 'Concert tickets', timestampMillis: d(2026, 6, 22, 19, 30) });
  addTx({
    amount: 45, type: 'EXPENSE', category: 'ENTERTAINMENT', note: 'Museum tickets, Prague trip',
    timestampMillis: d(2026, 6, 25, 14, 0), foreignAmount: 45, foreignCurrency: 'EUR',
  });
  addTx({ amount: 95, type: 'EXPENSE', category: 'HEALTH', note: 'Pharmacy', timestampMillis: d(2026, 6, 27, 17, 0) });
  addTx({
    amount: 55, type: 'EXPENSE', category: 'TRANSPORT', note: 'Parking (imported)',
    timestampMillis: d(2026, 6, 30, 9, 0), importSource: 'CSV', tags: ['auto-import'],
  });

  // July 2026 (month-to-date as of the export)
  addTx({ amount: 6885, type: 'INCOME', category: 'SALARY', note: 'Monthly salary', timestampMillis: d(2026, 7, 10, 9, 0) });
  addTx({ amount: 240, type: 'EXPENSE', category: 'FOOD', note: 'Weekly groceries', timestampMillis: d(2026, 7, 2, 18, 10) });
  addTx({ amount: 220, type: 'EXPENSE', category: 'FOOD', note: 'Weekly groceries', timestampMillis: d(2026, 7, 14, 18, 0) });
  addTx({ amount: 170, type: 'EXPENSE', category: 'TRANSPORT', note: 'Fuel', timestampMillis: d(2026, 7, 8, 8, 20) });
  addTx({ amount: 195, type: 'EXPENSE', category: 'UTILITIES', note: 'Electricity bill', timestampMillis: d(2026, 7, 12, 12, 0) });
  addTx({ amount: 260, type: 'EXPENSE', category: 'ENTERTAINMENT', note: 'Movie night', timestampMillis: d(2026, 7, 14, 20, 30) });
  addTx({ amount: 430, type: 'EXPENSE', category: 'SHOPPING', note: 'Noise-cancelling headphones', timestampMillis: d(2026, 7, 13, 16, 0), tags: ['gift'] });

  var FAINTO_SAMPLE_DATA = {
    schemaVersion: 1,
    exportedAtMillis: d(2026, 7, 15, 18, 42),
    financialProfile: {
      fullName: 'Anna Kowalska',
      countryOfResidence: 'Poland',
      incomeType: 'GROSS',
      currency: 'PLN',
      primaryIncome: 9500,
      secondIncome: null,
      annualBonus: 6000,
      monthlyTaxFreeAllowance: null,
      incomeFrequency: 'MONTHLY',
      grossIncome: 9500,
      taxRate: 0.23,
      netIncome: 6885,
      hasLoans: true,
      totalLoanDebt: 31500,
      monthlyLoanPayment: 850,
      loanApr: 7.9,
      loanNote: 'Car loan',
      hasLeasing: false,
      monthlyLeasingCost: null,
      leasingNote: '',
      leasingItems: [],
      monthlyRent: 2200,
      monthlyExpensesEstimate: 2600,
      expenseNote: 'Groceries, utilities, subscriptions',
      currentSavings: 18000,
      savingsGoal: 60000,
      savingsGoalTimeframe: '2028-01-01',
      savingsGoalType: 'EMERGENCY_FUND',
      primaryGoal: 'BUILD_EMERGENCY_FUND',
      employmentType: 'EMPLOYEE',
      taxationForm: 'SCALE',
      retirementAge: 65,
      taxAdvantagedMonthlySavings: 300,
    },
    transactions: tx,
    netWorth: {
      assets: [
        { id: 'a1', name: 'Checking Account', category: 'CHECKING', value: 6400, lastUpdatedMillis: d(2026, 7, 15, 9, 0) },
        { id: 'a2', name: 'Emergency Savings', category: 'SAVINGS', value: 18000, lastUpdatedMillis: d(2026, 7, 15, 9, 0) },
        { id: 'a3', name: 'Brokerage Account', category: 'INVESTMENT', value: 27500, lastUpdatedMillis: d(2026, 7, 10, 9, 0) },
        { id: 'a4', name: 'Toyota Corolla', category: 'VEHICLE', value: 46000, lastUpdatedMillis: d(2026, 6, 1, 9, 0), carBrand: 'TOYOTA', carModel: 'Corolla', carYear: 2023 },
        { id: 'a5', name: 'Retirement Account (PPK)', category: 'PENSION', value: 15200, lastUpdatedMillis: d(2026, 6, 30, 9, 0) },
      ],
      liabilities: [
        { id: 'l1', name: 'Apartment Mortgage', category: 'MORTGAGE', value: 265000, lastUpdatedMillis: d(2026, 7, 1, 9, 0) },
        { id: 'l2', name: 'Visa Credit Card', category: 'CREDIT_CARD', value: 3200, lastUpdatedMillis: d(2026, 7, 15, 9, 0) },
        { id: 'l3', name: 'Car Loan', category: 'LOAN', value: 31500, lastUpdatedMillis: d(2026, 7, 10, 9, 0) },
      ],
    },
    budgets: [
      { category: 'FOOD', limitAmount: 1200, period: 'MONTHLY', type: 'STANDARD' },
      { category: 'TRANSPORT', limitAmount: 500, period: 'MONTHLY', type: 'STANDARD' },
      { category: 'ENTERTAINMENT', limitAmount: 300, period: 'MONTHLY', type: 'STANDARD' },
      { category: 'SHOPPING', limitAmount: 400, period: 'MONTHLY', type: 'STANDARD' },
    ],
    portfolioHoldings: [
      { id: 'h1', name: 'iShares Core MSCI World ETF', assetClass: 'ETF', quantity: 120, costBasisPerUnit: 85, currentPricePerUnit: 96, currencyCode: 'PLN', updatedAtMillis: d(2026, 7, 14, 9, 0), expenseRatio: 0.2 },
      { id: 'h2', name: 'PKN Orlen', assetClass: 'STOCK', quantity: 40, costBasisPerUnit: 62, currentPricePerUnit: 55, currencyCode: 'PLN', updatedAtMillis: d(2026, 7, 14, 9, 0) },
      { id: 'h3', name: 'Polish 5Y Treasury Bond', assetClass: 'BOND', quantity: 10, costBasisPerUnit: 1000, currentPricePerUnit: 1015, currencyCode: 'PLN', updatedAtMillis: d(2026, 7, 10, 9, 0) },
      { id: 'h4', name: 'Gold ETC', assetClass: 'COMMODITY', quantity: 15, costBasisPerUnit: 210, currentPricePerUnit: 245, currencyCode: 'PLN', updatedAtMillis: d(2026, 7, 12, 9, 0) },
      { id: 'h5', name: 'Bitcoin Trust', assetClass: 'CRYPTO', quantity: 0.03, costBasisPerUnit: 150000, currentPricePerUnit: 205000, currencyCode: 'PLN', updatedAtMillis: d(2026, 7, 15, 9, 0) },
      { id: 'h6', name: 'Vanguard S&P 500 UCITS ETF', assetClass: 'ETF', quantity: 20, costBasisPerUnit: 90, currentPricePerUnit: 105, currencyCode: 'EUR', updatedAtMillis: d(2026, 7, 11, 9, 0) },
    ],
    cryptoHoldings: [
      { id: 'c1', symbol: 'BTC', name: 'Bitcoin', quantity: 0.02, walletOrExchange: 'Ledger (cold)', coinGeckoId: 'bitcoin', lastUpdatedMillis: d(2026, 7, 15, 9, 0) },
      { id: 'c2', symbol: 'ETH', name: 'Ethereum', quantity: 0.6, walletOrExchange: 'Kraken', coinGeckoId: 'ethereum', lastUpdatedMillis: d(2026, 7, 15, 9, 0) },
    ],
    subscriptions: [
      { merchant: 'Netflix', normalizedMerchant: 'netflix', amount: 43, cadence: 'MONTHLY', lastDateMillis: d(2026, 7, 5, 9, 0), monthlyEquivalent: 43, status: 'KNOWN' },
      { merchant: 'Spotify', normalizedMerchant: 'spotify', amount: 23.99, cadence: 'MONTHLY', lastDateMillis: d(2026, 7, 2, 9, 0), monthlyEquivalent: 23.99, status: 'KNOWN' },
      { merchant: 'iCloud+', normalizedMerchant: 'icloud', amount: 199, cadence: 'ANNUAL', lastDateMillis: d(2026, 3, 18, 9, 0), monthlyEquivalent: 16.58, status: 'REVIEW' },
    ],
    recurringPayments: [
      {
        id: 'r1', name: 'Apartment Rent', amount: 2200, currency: 'PLN', cadence: 'MONTHLY',
        anchorEpochDay: Math.floor(d(2026, 1, 1, 0, 0) / 86400000), category: 'RENT_HOUSING',
        reminderEnabled: true, note: '', createdAtMillis: d(2025, 6, 1, 9, 0), archived: false,
        amount_history: [2100, 2100, 2150, 2200], last_matched_transaction_millis: d(2026, 7, 1, 9, 0),
      },
      {
        id: 'r2', name: 'Gym Membership', amount: 129, currency: 'PLN', cadence: 'MONTHLY',
        anchorEpochDay: Math.floor(d(2026, 2, 5, 0, 0) / 86400000), category: 'HEALTH_FITNESS',
        reminderEnabled: false, note: '', createdAtMillis: d(2026, 2, 5, 9, 0), archived: false,
        amount_history: [99, 99, 129], last_matched_transaction_millis: d(2026, 7, 5, 9, 0),
      },
      {
        id: 'r3', name: 'Phone Plan', amount: 45, currency: 'PLN', cadence: 'MONTHLY',
        anchorEpochDay: Math.floor(d(2026, 1, 20, 0, 0) / 86400000), category: 'SOFTWARE',
        reminderEnabled: false, note: '', createdAtMillis: d(2025, 9, 20, 9, 0), archived: false,
        amount_history: [], last_matched_transaction_millis: d(2026, 7, 20, 9, 0),
      },
      {
        id: 'r4', name: 'Old Cloud Storage', amount: 20, currency: 'PLN', cadence: 'YEARLY',
        anchorEpochDay: Math.floor(d(2025, 11, 1, 0, 0) / 86400000), category: 'SOFTWARE',
        reminderEnabled: false, note: 'Cancelled, kept for records', createdAtMillis: d(2024, 11, 1, 9, 0), archived: true,
        amount_history: [20], last_matched_transaction_millis: d(2025, 11, 1, 9, 0),
      },
    ],
    trackedDebts: [
      { id: 'd1', name: 'Visa Credit Card', category: 'CREDIT_CARD', balance: 3200, aprPercent: 21.9, minPayment: 160, creditLimit: 8000, lastUpdatedMillis: d(2026, 7, 15, 9, 0) },
      { id: 'd2', name: 'Car Loan', category: 'AUTO_LOAN', balance: 31500, aprPercent: 7.9, minPayment: 850, creditLimit: null, lastUpdatedMillis: d(2026, 7, 10, 9, 0) },
      { id: 'd3', name: 'Student Loan', category: 'STUDENT_LOAN', balance: 9800, aprPercent: 4.5, minPayment: 210, creditLimit: null, lastUpdatedMillis: d(2026, 6, 30, 9, 0) },
    ],
    billReminders: [
      { id: 'b1', name: 'Rent', amountDue: 2200, dueDayOfMonth: 1, isRecurring: true },
      { id: 'b2', name: 'Electricity', amountDue: 210, dueDayOfMonth: 15, isRecurring: true },
      { id: 'b3', name: 'Internet', amountDue: 65, dueDayOfMonth: 20, isRecurring: true },
      { id: 'b4', name: 'Car Insurance', amountDue: 980, dueDayOfMonth: 28, isRecurring: false },
    ],
    chatHistory: [
      { role: 'USER', content: 'How am I doing on my savings goal this month?', isStreaming: false, isError: false, id: 'msg1' },
      { role: 'ASSISTANT', content: "You're on track — based on your last 30 days you saved about 18% of net income, close to your 20% target. Keep an eye on Entertainment spending, it's trending up this month.", isStreaming: false, isError: false, id: 'msg2' },
      { role: 'USER', content: 'Can you check this note: </script><img src=x onerror="alert(1)"> and "quotes" \\ backslash test', isStreaming: false, isError: false, id: 'msg3' },
      { role: 'ASSISTANT', content: "That looks like a stray note rather than a question — it's stored as plain text, nothing in it can run. Want budgeting advice instead?", isStreaming: false, isError: false, id: 'msg4' },
    ],
  };

  window.FAINTO_SAMPLE_DATA = FAINTO_SAMPLE_DATA;
}());
