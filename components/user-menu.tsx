"use client"

import {
  CreditCardIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"

export function UserMenu() {
  const router = useRouter()
  const handleLogout = async () => {
    await authClient.signOut()
    router.push("/login")
  }
  const { data: data } = authClient.useSession()

  console.log("Data ---------------> ", data)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar>
          <AvatarImage
            src={data?.user.image || undefined}
            alt={data?.user.name}
          />
          <AvatarFallback>
            {data?.user.name
              .trim()
              .match(/\b\w/g)
              ?.slice(0, 2)
              .join("")
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={"w-auto"}>
        <div className="flex items-center gap-2 px-2 py-1">
          <Avatar>
            <AvatarImage
              src={data?.user.image || undefined}
              alt={data?.user.name}
            />
            <AvatarFallback>
              {data?.user.name
                .trim()
                .match(/\b\w/g)
                ?.slice(0, 2)
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <p className="text-sm font-medium">{data?.user.name}</p>
            <p className="text-xs text-muted-foreground">{data?.user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Account Settings</DropdownMenuLabel>
          <DropdownMenuItem>
            <UserIcon />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCardIcon />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem>
            <SettingsIcon />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
