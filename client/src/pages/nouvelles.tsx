import { useEffect } from "react";
import { useLocation } from "wouter";

export default function NouvellesPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/blog?tab=nouvelles");
  }, [setLocation]);

  return null;
}
