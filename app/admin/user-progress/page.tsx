"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, RefreshCw, AlertTriangle, Award, CheckCircle, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface UserProgress {
  userId: string
  name?: string
  email?: string
  completedChapters?: string[]
  unlockedChapters?: string[]
  finalTestCompleted?: boolean
  certificateUnlocked?: boolean
  completionPercentage?: number
  lastUpdated?: string
  totalChapters?: number
}

export default function UserProgressPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userProgress, setUserProgress] = useState<UserProgress[]>([])
  const [filteredProgress, setFilteredProgress] = useState<UserProgress[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("all")
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserProgress | null>(null)
  const [completedChapters, setCompletedChapters] = useState<string[]>([])
  const [remainingChapters, setRemainingChapters] = useState<string[]>([])

  // Get authentication token
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("firebase-auth-token") || sessionStorage.getItem("firebase-auth-token")
      if (token) {
        setIdToken(token)
      }
    }
  }, [])

  // Fetch user progress data
  useEffect(() => {
    if (idToken) {
      fetchUserProgress()
    }
  }, [idToken])

  const fetchUserProgress = async () => {
    setLoading(true)
    setError(null)

    try {
      const token = idToken

      if (!token) {
        console.warn("Authentication token not available, skipping fetch")
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

      if (!progressResponse.ok) {
        if (progressResponse.status === 401) {
          router.push("/admin/login")
          return
        }
        throw new Error(`HTTP error! status: ${progressResponse.status}`)
      }

      const progressData = await progressResponse.json()
      console.log("Fetched progress data:", progressData)

      if (!progressData.progress || progressData.progress.length === 0) {
        console.log("No user progress found in response")
        setError("No user progress found. Try refreshing the page or check the database connection.")
        setLoading(false)
        return
      }

      // Fetch users to get names and emails
      const usersResponse = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-firebase-auth-token": token,
        },
      })

      let users: any[] = []

      if (usersResponse.ok) {
        const userData = await usersResponse.json()
        users = userData.users || []
      }

      // Merge progress with user data
      const progressWithUserInfo = progressData.progress.map((progress: any) => {
        const user = users.find((u) => u.id === progress.userId)
        const totalChapters = 70 // Total of 70 chapters
        const completedCount = progress.completedChapters?.length || 0
        const completionPercentage = Math.round((completedCount / totalChapters) * 100)

        return {
          ...progress,
          name: progress.name || (user ? user.name : "Unknown"),
          email: progress.email || (user ? user.email : "Unknown"),
          completionPercentage,
          totalChapters,
        }
      })

      setUserProgress(progressWithUserInfo)
      setFilteredProgress(progressWithUserInfo)
    } catch (err: any) {
      console.error("Failed to fetch user progress:", err)
      setError(err.message || "Failed to fetch user progress")
    } finally {
      setLoading(false)
    }
  }

  // Handle search
  const handleSearch = () => {
    if (!searchTerm.trim()) {
      filterByTab(activeTab)
      return
    }

    const filtered = userProgress.filter((progress) => {
      const nameMatch = progress.name?.toLowerCase().includes(searchTerm.toLowerCase())
      const emailMatch = progress.email?.toLowerCase().includes(searchTerm.toLowerCase())
      const idMatch = progress.userId.toLowerCase().includes(searchTerm.toLowerCase())

      return nameMatch || emailMatch || idMatch
    })

    setFilteredProgress(filtered)
  }

  // Filter by tab
  const filterByTab = (tab: string) => {
    setActiveTab(tab)

    if (tab === "all") {
      setFilteredProgress(userProgress)
      return
    }

    if (tab === "completed") {
      const filtered = userProgress.filter((p) => p.completionPercentage === 100)
      setFilteredProgress(filtered)
      return
    }

    if (tab === "inProgress") {
      const filtered = userProgress.filter(
        (p) => (p.completionPercentage || 0) > 0 && (p.completionPercentage || 0) < 100,
      )
      setFilteredProgress(filtered)
      return
    }

    if (tab === "notStarted") {
      const filtered = userProgress.filter((p) => !p.completedChapters || p.completedChapters.length === 0)
      setFilteredProgress(filtered)
      return
    }
  }

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchUserProgress()
    } catch (error) {
      console.error("Error refreshing user progress:", error)
    } finally {
      setRefreshing(false)
    }
  }

  // Format date
  const formatDate = (dateString?: string) => {
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
  
  // Handle showing user details
  const handleShowDetails = (progress: UserProgress) => {
    const chaptersCompleted = progress.completedChapters || [];
    const chaptersNotCompleted = Array.from(
      { length: progress.totalChapters || 70 },
      (_, i) => `CH-${String(i + 1).padStart(3, '0')}`
    ).filter(ch => !chaptersCompleted.includes(ch));
    
    setSelectedUser(progress);
    setCompletedChapters(chaptersCompleted);
    setRemainingChapters(chaptersNotCompleted);
    setShowDetailsDialog(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading user progress...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">User Progress</h1>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
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
          <CardDescription>Search for users by name or email</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <div className="flex-1">
              <Input
                placeholder="Search by name or email..."
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Progress ({filteredProgress.length})</CardTitle>
          <CardDescription>
            {searchTerm ? `Showing results for "${searchTerm}"` : "Showing all user progress"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" onValueChange={filterByTab} className="mb-6">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="all">All Users</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="inProgress">In Progress</TabsTrigger>
              <TabsTrigger value="notStarted">Not Started</TabsTrigger>
            </TabsList>
          </Tabs>

          {filteredProgress.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No users found matching your search." : "No user progress data found."}
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Name</TableHead>
                      <TableHead className="whitespace-nowrap">Email</TableHead>
                      <TableHead className="whitespace-nowrap">Progress</TableHead>
                      <TableHead className="whitespace-nowrap">Chapters</TableHead>
                      <TableHead className="whitespace-nowrap">Final Test</TableHead>
                      <TableHead className="whitespace-nowrap">Certificate</TableHead>
                      <TableHead className="whitespace-nowrap">Last Updated</TableHead>
                      <TableHead className="whitespace-nowrap">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProgress.map((progress) => (
                      <TableRow key={progress.userId}>
                        <TableCell className="font-medium whitespace-nowrap">{progress.name || "Unknown"}</TableCell>
                        <TableCell className="whitespace-nowrap max-w-[150px] truncate">
                          {progress.email || "Unknown"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Progress value={progress.completionPercentage || 0} className="h-2 w-16 sm:w-24" />
                            <span className="text-xs font-medium">{progress.completionPercentage || 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {progress.completedChapters?.length || 0} / {progress.totalChapters || 70}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {progress.finalTestCompleted ? (
                            <Badge variant="default" className="bg-green-600">
                              Completed
                            </Badge>
                          ) : (
                            <Badge variant="outline">Not Completed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {progress.certificateUnlocked ? (
                            <Badge variant="default" className="bg-amber-600">
                              <Award className="h-3 w-3 mr-1" />
                              Unlocked
                            </Badge>
                          ) : (
                            <Badge variant="outline">Locked</Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(progress.lastUpdated)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleShowDetails(progress)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {/* User Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>User Progress Details</DialogTitle>
            <DialogDescription>
              {selectedUser?.name || "Unknown"} ({selectedUser?.email || "Unknown"})
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 flex-grow overflow-hidden">
            <div className="space-y-2">
              <div className="font-semibold flex items-center">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                Completed Chapters ({completedChapters.length})
              </div>
              <ScrollArea className="h-[300px] border rounded-md p-4">
                {completedChapters.length > 0 ? (
                  <div className="space-y-2">
                    {completedChapters.map((chapter) => (
                      <div key={chapter} className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                        <span>{chapter}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-center py-4">No chapters completed yet</div>
                )}
              </ScrollArea>
            </div>
            
            <div className="space-y-2">
              <div className="font-semibold flex items-center">
                <XCircle className="h-4 w-4 text-red-600 mr-2" />
                Remaining Chapters ({remainingChapters.length})
              </div>
              <ScrollArea className="h-[300px] border rounded-md p-4">
                {remainingChapters.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {remainingChapters.map((chapter) => (
                      <div key={chapter} className="flex items-center">
                        <XCircle className="h-4 w-4 text-red-600 mr-2" />
                        <span>{chapter}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-center py-4">All chapters completed!</div>
                )}
              </ScrollArea>
            </div>
          </div>
          
          <DialogFooter>
            <div className="w-full flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Last updated: {selectedUser ? formatDate(selectedUser.lastUpdated) : "N/A"}
              </div>
              <Button onClick={() => setShowDetailsDialog(false)}>Close</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
