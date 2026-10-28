import { ThemeToggle } from "@/components/ThemeToggle";

export default function AppearanceSettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-2.5 text-[13px] font-semibold">外观</h2>
        <ThemeToggle />
      </div>
    </div>
  );
}
