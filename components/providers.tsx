"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";


export default function Providers({ children }: { children: ReactNode }) {
    console.log("PRIVY APP ID:", process.env.NEXT_PUBLIC_PRIVY_APP_ID);
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#f97316",
          showWalletLoginFirst: false,
        },
        loginMethods: ["email", "wallet"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
          showWalletUIs: true,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}