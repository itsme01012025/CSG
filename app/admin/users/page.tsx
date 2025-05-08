"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Search, RefreshCw, AlertTriangle, UserPlus, MoreHorizontal, BookOpen, Eye, CheckCircle, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"

interface User {
  id: string
  name: string
  email: string
  status: "active" | "inactive" | "completed"
  role: "user" | "admin"
  createdAt: string
  lastLogin: string
  authProvider?: string
  progress?: {
    completedChapters?: string[]
    unlockedChapters?: string[]
    finalTestCompleted?: boolean
    certificateUnlocked?: boolean
    completionPercentage?: number
  }
}

export default function UsersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [searchField, setSearchField] = useState<"name" | "email" | "id">("name")
  const [refreshing, setRefreshing] = useState(false)
  const [showAddUserDialog, setShowAddUserDialog] = useState(false)
  const [showUserProgressDialog, setShowUserProgressDialog] = useState(false)
  const [showUserDetailsDialog, setShowUserDetailsDialog] = useState(false)
  const [showEditUserDialog, setShowEditUserDialog] = useState(false)
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(true) // Assuming admin access for now
  const [idToken, setIdToken] = useState<string | null>(null) // Will be set in useEffect
  const [newUserData, setNewUserData] = useState({
    name: "",
    email: "",
    role: "user",
    status: "active",
  })
  const [editUserData, setEditUserData] = useState({
    name: "",
    email: "",
    role: "user",
    status: "active",
  })
  const [addingUser, setAddingUser] = useState(false)
  const [editingUser, setEditingUser] = useState(false)
  const [deletingUser, setDeletingUser] = useState(false)
  const [userProgress, setUserProgress] = useState<any[]>([])
  const [progressLoading, setProgressLoading] = useState(false)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Get authentication token
  useEffect(() => {
    // For client-side only
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("firebase-auth-token") || sessionStorage.getItem("firebase-auth-token")
      if (token) {
        setIdToken(token)
      }
    }
  }, [])

  // Fetch real users data from API
  useEffect(() => {
    if (isAdmin && idToken) {
      fetchUsers()
    }
  }, [isAdmin, idToken])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)

    try {
      // Use only idToken from context for server components
      const token = idToken

      if (!token) {
        console.warn("Authentication token not available, skipping fetch")
        setLoading(false)
        return
      }

      // Fetch users
      const response = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-firebase-auth-token": token, // Add custom header as fallback
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/admin/login")
          return
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const userData = await response.json()
      console.log("Fetched users data:", userData)

      if (!userData.users || userData.users.length === 0) {
        console.log("No users found in response")
        setError("No users found. Try refreshing the page or check the database connection.")
        setLoading(false)
        return
      }

      // Fetch user progress
      const progressResponse = await fetch("/api/admin/user-progress", {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-firebase-auth-token": token,
        },
      })

      let progressData: any = { progress: [] }

      if (progressResponse.ok) {
        progressData = await progressResponse.json()
        console.log("Fetched progress data:", progressData)
      } else {
        console.error("Failed to fetch user progress:", progressResponse.status)
      }

      // Store progress data for later use
      setUserProgress(progressData.progress || [])

      // Merge user data with progress data
      const usersWithProgress = userData.users.map((user: User) => {
        const userProgressData = progressData.progress?.find((p: any) => p.userId === user.id)

        if (userProgressData) {
          const totalChapters = 70 // Total of 70 chapters
          const completedCount = userProgressData.completedChapters?.length || 0
          const completionPercentage = Math.round((completedCount / totalChapters) * 100)

          return {
            ...user,
            progress: {
              completedChapters: userProgressData.completedChapters || [],
              unlockedChapters: userProgressData.unlockedChapters || [],
              finalTestCompleted: userProgressData.finalTestCompleted || false,
              certificateUnlocked: userProgressData.certificateUnlocked || false,
              completionPercentage,
            },
          }
        }

        return {
          ...user,
          progress: {
            completedChapters: [],
            unlockedChapters: [],
            finalTestCompleted: false,
            certificateUnlocked: false,
            completionPercentage: 0,
          },
        }
      })

      setUsers(usersWithProgress)
      setFilteredUsers(usersWithProgress)
    } catch (err: any) {
      console.error("Failed to fetch users:", err)
      setError(err.message || "Failed to fetch users")
    } finally {
      setLoading(false)
    }
  }

  // Handle search
  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users)
      return
    }

    const filtered = users.filter((user) => {
      const fieldValue = user[searchField]?.toString().toLowerCase() || ""
      return fieldValue.includes(searchTerm.toLowerCase())
    })

    setFilteredUsers(filtered)
  }

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchUsers()
    } catch (error) {
      console.error("Error refreshing users:", error)
    } finally {
      setRefreshing(false)
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"

    try {
      const date = new Date(dateString)
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    } catch (e) {
      return dateString
    }
  }

  // Handle add user
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingUser(true)

    try {
      const token = idToken

      if (!token) {
        throw new Error("Authentication token not available")
      }

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-firebase-auth-token": token,
        },
        body: JSON.stringify(newUserData),
      })

      if (!response.ok) {
        throw new Error(`Failed to add user: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.user) {
        // Add the new user to the list with default progress
        const newUser: User = {
          ...data.user,
          id: data.user.id,
          createdAt: data.user.createdAt || new Date().toISOString(),
          lastLogin: "Never",
          progress: {
            completedChapters: [],
            unlockedChapters: [],
            finalTestCompleted: false,
            certificateUnlocked: false,
            completionPercentage: 0,
          },
        }

        setUsers([newUser, ...users])
        setFilteredUsers([newUser, ...filteredUsers])
      }

      // Reset form and close dialog
      setNewUserData({
        name: "",
        email: "",
        role: "user",
        status: "active",
      })
      setShowAddUserDialog(false)
    } catch (err: any) {
      console.error("Failed to add user:", err)
      setError(err.message || "Failed to add user")
    } finally {
      setAddingUser(false)
    }
  }

  // View user progress
  const handleViewProgress = (user: User) => {
    setSelectedUser(user)
    setShowUserProgressDialog(true)
  }

  // View user details
  const handleViewDetails = (user: User) => {
    setSelectedUser(user)
    setShowUserDetailsDialog(true)
  }

  // Edit user
  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setEditUserData({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "user",
      status: user.status || "active",
    })
    setShowEditUserDialog(true)
  }

  // Save edited user
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditingUser(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      const token = idToken

      if (!token || !selectedUser) {
        throw new Error("Authentication token not available or no user selected")
      }

      // Prepare user data with isAdmin flag for Firestore
      const userData = {
        ...editUserData,
        isAdmin: editUserData.role === "admin",
        status: editUserData.status,
        updatedAt: new Date().toISOString(),
      }

      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-firebase-auth-token": token,
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          userData,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to update user: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.user) {
        // Update the user in the list
        const updatedUsers = users.map((u) => (u.id === selectedUser.id ? data.user : u))
        setUsers(updatedUsers)
        setFilteredUsers(
          filteredUsers.map((u) => (u.id === selectedUser.id ? data.user : u))
        )
        setActionSuccess("User updated successfully")
        
        // Close dialog after a delay
        setTimeout(() => {
          setShowEditUserDialog(false)
          setActionSuccess(null)
        }, 1500)
      }
    } catch (err: any) {
      console.error("Failed to update user:", err)
      setActionError(err.message || "Failed to update user")
    } finally {
      setEditingUser(false)
    }
  }

  // Delete user
  const handleDeleteUser = (user: User) => {
    setSelectedUser(user)
    setShowDeleteConfirmDialog(true)
  }

  // Confirm delete user
  const handleConfirmDelete = async () => {
    setDeletingUser(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      const token = idToken

      if (!token || !selectedUser) {
        throw new Error("Authentication token not available or no user selected")
      }

      const response = await fetch(`/api/admin/users?userId=${selectedUser.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-firebase-auth-token": token,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to delete user: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        // Remove the user from the list
        setUsers(users.filter((u) => u.id !== selectedUser.id))
        setFilteredUsers(filteredUsers.filter((u) => u.id !== selectedUser.id))
        setActionSuccess("User deleted successfully")
        
        // Close dialog after a delay
        setTimeout(() => {
          setShowDeleteConfirmDialog(false)
          setActionSuccess(null)
        }, 1500)
      }
    } catch (err: any) {
      console.error("Failed to delete user:", err)
      setActionError(err.message || "Failed to delete user")
    } finally {
      setDeletingUser(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading users...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">User Management</h1>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
          <Button onClick={() => setShowAddUserDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Search Users</CardTitle>
          <CardDescription>Search for users by name, email, or ID</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <Tabs defaultValue="name" onValueChange={(value) => setSearchField(value as any)}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="name">Name</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="id">User ID</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex space-x-2">
              <div className="flex-1">
                <Input
                  placeholder={`Search by ${searchField}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <CardDescription>
            {searchTerm ? `Showing results for "${searchTerm}" in ${searchField}` : "Showing all users"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No users found matching your search." : "No users found."}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || "Unknown"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.status === "active" ? (
                          <Badge variant="default" className="bg-green-600">
                            Active
                          </Badge>
                        ) : user.status === "completed" ? (
                          <Badge variant="secondary">Completed</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.role === "admin" ? (
                          <Badge variant="default" className="bg-purple-600">
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline">User</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-full max-w-[100px]">
                                <Progress value={user.progress?.completionPercentage || 0} className="h-2" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{user.progress?.completionPercentage || 0}% Complete</p>
                              <p>{user.progress?.completedChapters?.length || 0} of 10 chapters completed</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>{formatDate(user.lastLogin)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleViewProgress(user)}>
                              <BookOpen className="h-4 w-4 mr-2" />
                              View Progress
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewDetails(user)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditUser(user)}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                              </svg>
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteUser(user)} 
                              className="text-destructive"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2">
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                              </svg>
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddUser} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={newUserData.name}
                onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                placeholder="Enter full name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newUserData.email}
                onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                placeholder="Enter email address"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newUserData.role}
                onValueChange={(value) => setNewUserData({ ...newUserData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={newUserData.status}
                onValueChange={(value) => setNewUserData({ ...newUserData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" type="button" onClick={() => setShowAddUserDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addingUser}>
                {addingUser ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add User"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* User Progress Dialog */}
      <Dialog open={showUserProgressDialog} onOpenChange={setShowUserProgressDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>User Progress</DialogTitle>
            <DialogDescription>{selectedUser?.name}'s course progress and achievements</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto px-1">
            {progressLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2">Loading progress data...</span>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium">Course Completion</h3>
                    <span className="text-sm font-bold">{selectedUser?.progress?.completionPercentage || 0}%</span>
                  </div>
                  <Progress value={selectedUser?.progress?.completionPercentage || 0} className="h-2" />
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Completed Chapters</h3>
                  {selectedUser?.progress?.completedChapters?.length ? (
                    <ScrollArea className="h-[300px] border rounded-md p-4">
                      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {selectedUser.progress.completedChapters.map((chapter: string) => (
                          <div key={chapter} className="flex items-center bg-green-50 dark:bg-green-950/30 p-2 rounded-md">
                            <CheckCircle className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                            <span className="text-sm truncate">{chapter}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground">No chapters completed yet.</p>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Remaining Chapters</h3>
                  {selectedUser?.progress?.completedChapters?.length !== 70 ? (
                    <ScrollArea className="h-[200px] border rounded-md p-4">
                      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {Array.from(
                          { length: 70 },
                          (_, i) => `CH-${String(i + 1).padStart(3, '0')}`
                        )
                          .filter(ch => !selectedUser?.progress?.completedChapters?.includes(ch))
                          .map((chapter: string) => (
                            <div key={chapter} className="flex items-center bg-red-50 dark:bg-red-950/30 p-2 rounded-md">
                              <XCircle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" />
                              <span className="text-sm truncate">{chapter}</span>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground">All chapters completed!</p>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Achievements</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center">
                      <Badge
                        variant={selectedUser?.progress?.finalTestCompleted ? "default" : "outline"}
                        className="mr-2"
                      >
                        {selectedUser?.progress?.finalTestCompleted ? "Completed" : "Incomplete"}
                      </Badge>
                      <span className="text-sm">Final Test</span>
                    </div>
                    <div className="flex items-center">
                      <Badge
                        variant={selectedUser?.progress?.certificateUnlocked ? "default" : "outline"}
                        className="mr-2"
                      >
                        {selectedUser?.progress?.certificateUnlocked ? "Unlocked" : "Locked"}
                      </Badge>
                      <span className="text-sm">Certificate</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            <DialogFooter className="mt-6">
              <Button onClick={() => setShowUserProgressDialog(false)}>Close</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Details Dialog */}
      <Dialog open={showUserDetailsDialog} onOpenChange={setShowUserDetailsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Detailed information about the user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedUser && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">User ID</Label>
                    <div className="font-mono text-sm mt-1 break-all">{selectedUser.id}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Auth Provider</Label>
                    <div className="font-medium mt-1">{selectedUser.authProvider || "Email/Password"}</div>
                  </div>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <div className="font-medium mt-1">{selectedUser.name || "Not set"}</div>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <div className="font-medium mt-1">{selectedUser.email}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Role</Label>
                    <div className="mt-1">
                      <Badge variant={selectedUser.role === "admin" ? "default" : "outline"} className={selectedUser.role === "admin" ? "bg-purple-600" : ""}>
                        {selectedUser.role === "admin" ? "Admin" : "User"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <Badge 
                        variant={selectedUser.status === "active" ? "default" : selectedUser.status === "completed" ? "secondary" : "outline"}
                        className={selectedUser.status === "active" ? "bg-green-600" : ""}
                      >
                        {selectedUser.status === "active" ? "Active" : selectedUser.status === "completed" ? "Completed" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Created</Label>
                    <div className="font-medium mt-1">{formatDate(selectedUser.createdAt)}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Last Login</Label>
                    <div className="font-medium mt-1">{formatDate(selectedUser.lastLogin)}</div>
                  </div>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">Progress</Label>
                  <div className="mt-1">
                    <Progress value={selectedUser.progress?.completionPercentage || 0} className="h-2" />
                    <div className="text-sm mt-1">
                      {selectedUser.progress?.completionPercentage || 0}% Complete ({selectedUser.progress?.completedChapters?.length || 0} of 10 chapters)
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowUserDetailsDialog(false)}>Close</Button>
            <Button onClick={() => {
              setShowUserDetailsDialog(false)
              if (selectedUser) handleEditUser(selectedUser)
            }} variant="outline">Edit User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveUser}>
            <div className="space-y-4 py-2">
              {actionSuccess && (
                <Alert className="bg-green-50 text-green-800 border-green-200">
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>{actionSuccess}</AlertDescription>
                </Alert>
              )}
              
              {actionError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editUserData.name}
                  onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                  placeholder="User's name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editUserData.email}
                  onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Role</Label>
                  <Select
                    value={editUserData.role}
                    onValueChange={(value) => setEditUserData({ ...editUserData, role: value as "user" | "admin" })}
                  >
                    <SelectTrigger id="edit-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editUserData.status}
                    onValueChange={(value) => setEditUserData({ ...editUserData, status: value as "active" | "inactive" | "completed" })}
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <DialogFooter className="mt-6">
              <Button variant="outline" type="button" onClick={() => setShowEditUserDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editingUser}>
                {editingUser ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {actionSuccess && (
              <Alert className="bg-green-50 text-green-800 border-green-200">
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{actionSuccess}</AlertDescription>
              </Alert>
            )}
            
            {actionError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}
            
            {selectedUser && (
              <div className="mt-2 space-y-2">
                <div>
                  <span className="font-medium">Name:</span> {selectedUser.name}
                </div>
                <div>
                  <span className="font-medium">Email:</span> {selectedUser.email}
                </div>
                <div>
                  <span className="font-medium">User ID:</span> <span className="font-mono text-sm">{selectedUser.id}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete}
              disabled={deletingUser}
            >
              {deletingUser ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}