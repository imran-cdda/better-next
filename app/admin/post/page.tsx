"use client"

import * as React from "react"
import { PlusIcon, TrashIcon } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

interface Post {
  id: string
  content: string
  createdAt: string
  updatedAt: string
}

export default function PostPage() {
  const [posts, setPosts] = React.useState<Post[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)
  const [content, setContent] = React.useState("")

  const fetchPosts = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await authClient.post.list()
      if (error) {
        toast.error("Failed to fetch posts")
        return
      }
      setPosts((data as Post[]) || [])
    } catch {
      toast.error("Failed to fetch posts")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setIsCreating(true)
    try {
      const { data, error } = await authClient.post.add({ content })
      if (error) {
        toast.error("Failed to create post")
        return
      }
      toast.success("Post created successfully")
      setContent("")
      setIsOpen(false)
      fetchPosts()
    } catch {
      toast.error("Failed to create post")
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeletePost = async (id: string) => {
    try {
      const { error } = await authClient.post.delete({ id })
      if (error) {
        toast.error("Failed to delete post")
        return
      }
      toast.success("Post deleted")
      fetchPosts()
    } catch {
      toast.error("Failed to delete post")
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Posts</h1>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button>
              <PlusIcon className="size-4" />
              Create Post
            </Button>
          </SheetTrigger>
          <SheetContent>
            <form onSubmit={handleCreatePost}>
              <SheetHeader>
                <SheetTitle>Create New Post</SheetTitle>
                <SheetDescription>
                  Write your post content below.
                </SheetDescription>
              </SheetHeader>
              <div className="py-4">
                <textarea
                  className="min-h-[150px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                  placeholder="What's on your mind?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
              <SheetFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating || !content.trim()}>
                  {isCreating ? "Creating..." : "Create Post"}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">Loading posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">No posts yet. Create one!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="rounded-lg border bg-card p-4 text-card-foreground"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="whitespace-pre-wrap">{post.content}</p>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDeletePost(post.id)}
                  >
                    <TrashIcon className="size-4 text-destructive" />
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(post.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
