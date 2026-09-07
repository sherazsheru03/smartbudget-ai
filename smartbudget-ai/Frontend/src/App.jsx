import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Auth from "./pages/Auth/Auth";
import Dashboard from "./pages/Dashboard/Dashboard";
import AddExpense from "./pages/Expenses";
import EditExpense from "./pages/Expenses/EditExpense";
import Analytics from "./pages/Analytics/Analytics";
import Budgets from "./pages/Budgets/Budgets";

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Home />}
      />

      <Route
        path="/login"
        element={<Auth />}
      />

      <Route
        path="/dashboard"
        element={<Dashboard />}
      />

      <Route
        path="/expenses/add"
        element={<AddExpense />}
      />

      <Route
        path="/expenses/edit/:id"
        element={<EditExpense />}
      />

      <Route
        path="/analytics"
        element={<Analytics />}
      />

      <Route
        path="/budgets"
        element={<Budgets />}
      />
    </Routes>
  );
}

export default App;