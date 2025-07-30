"use client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import RandomPixelAvatar from "@/components/account/random-avatar";
import { Loader2Icon } from "lucide-react";

function AccountMenu() {
  const { login, logout, loggedIn, loadingAuth, authState } = useAuth();
  const { idToken, username, walletAddress } = authState;
  //const isAuthenticated = !!idToken;

  if (loadingAuth) {
    return (
      <div className="m-3 flex justify-center">
        <Loader2Icon className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  return (
    <>
      {loggedIn ? (
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="rounded-full overflow-hidden">
                <RandomPixelAvatar
                  username={username || walletAddress || ""}
                  size={32}
                />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>{username}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* Profile Button */}
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/" passHref target="_blank">
                  Report Issue
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/" passHref target="_blank">
                  Give Feedback
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Logout Button */}
              <DropdownMenuItem
                onClick={() => {
                  logout();
                }}
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <div>
          <Button onClick={login} className="h-8">
            Login
          </Button>
        </div>
      )}
    </>
  );
}

export default AccountMenu;
