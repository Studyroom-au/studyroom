import AlexBuddy from "@/components/AlexBuddy";

export default function LobbyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AlexBuddy />
    </>
  );
}
