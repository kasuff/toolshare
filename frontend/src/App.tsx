import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useSession } from "./hooks/useSession";
import { DashboardPage } from "./pages/DashboardPage";
import { ToolsPage } from "./pages/ToolsPage";
import { NewToolPage } from "./pages/NewToolPage";
import { WorkshopsPage } from "./pages/WorkshopsPage";
import { NewWorkshopPage } from "./pages/NewWorkshopPage";
import { InboxPage } from "./pages/InboxPage";

export default function App() {
  const { users, currentUser, switchUser } = useSession();

  if (!currentUser) return <p>Kein Nutzer aktiv.</p>;

  return (
    <Routes>
      <Route
        path="/"
        element={<Layout users={users} currentUser={currentUser} onSwitchUser={switchUser} />}
      >
        <Route index element={<DashboardPage />} />
        <Route path="tools" element={<ToolsPage currentUser={currentUser} />} />
        <Route path="tools/new" element={<NewToolPage currentUser={currentUser} />} />
        <Route path="workshops" element={<WorkshopsPage currentUser={currentUser} />} />
        <Route path="workshops/new" element={<NewWorkshopPage currentUser={currentUser} />} />
        <Route path="inbox" element={<InboxPage currentUser={currentUser} />} />
      </Route>
    </Routes>
  );
}
