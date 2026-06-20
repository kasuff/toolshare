import { Redirect } from 'expo-router';

export default function RootIndex() {
  // Redirect to tools screen by default; useAuth in _layout will handle redirection to /login if not authenticated
  return <Redirect href="/tools" />;
}
