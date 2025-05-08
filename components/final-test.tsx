"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, Trophy, CreditCard, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchQuizQuestions, type QuizQuestion } from "@/lib/quiz-service"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import CouponForm from "@/components/coupon-form"

export function FinalTest() {
  const { user } = useAuth()
  const router = useRouter()
  const [score, setScore] = useState<number | null>(null)
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null)
  const [passingScore, setPassingScore] = useState(9) // 30% of 30 questions
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  // Removed voucher dialog in favor of integrated coupon form
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [testLoading, setTestLoading] = useState(false)
  interface UserProgress {
    finalTestCompleted?: boolean;
    certificateUnlocked?: boolean;
    paymentCompleted?: boolean;
    finalTestUnlocked?: boolean;
    [key: string]: any;
  }
  
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null)
  const [certificateUnlocked, setCertificateUnlocked] = useState(false)
  const [finalTestCompleted, setFinalTestCompleted] = useState(false)

  // Check if user is allowed to take the final test
  useEffect(() => {
    async function checkUserProgress() {
      if (!user) {
        router.push("/login")
        return
      }

      setLoading(true)
      setError(null)

      try {
        // Initialize auth header
        let authHeader = {}
        
        // Get token from localStorage or cookies
        const token = typeof window !== 'undefined' ? 
          localStorage.getItem('firebase-auth-token') : null;
          
        if (token) {
          authHeader = {
            "Authorization": `Bearer ${token}`
          }
        } else {
          console.warn("No authentication token found in localStorage")
        }
        
        // Check if user is eligible to take the final test (has a valid coupon or has paid)
        const eligibilityResponse = await fetch("/api/check-final-test-eligibility", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader
          },
          body: JSON.stringify({
            couponCode: null // Just checking current eligibility status
          }),
        })
        
        const eligibilityData = await eligibilityResponse.json()
        
        if (!eligibilityResponse.ok) {
          throw new Error(eligibilityData.error || "Failed to check eligibility")
        }
        
        // If not eligible, show payment/coupon dialog
        if (!eligibilityData.eligible) {
          setShowPaymentDialog(true)
        }
        
        // Fetch user progress to check if final test is unlocked
        const progressResponse = await fetch(`/api/user-progress?userId=${user.id}`)

        if (!progressResponse.ok) {
          throw new Error(`HTTP error! status: ${progressResponse.status}`)
        }

        const progressData = await progressResponse.json()
        setUserProgress(progressData.progress)

        // Check if user has already completed the final test
        if (progressData.progress.finalTestCompleted) {
          setFinalTestCompleted(true)
          setCertificateUnlocked(progressData.progress.certificateUnlocked)

          // Set placeholder score for now (in a real app, you'd fetch the actual score)
          setScore(progressData.progress.certificateUnlocked ? 20 : 6)
          setTotalQuestions(30)
        } else {
          // Check if user has paid for the final test
          if (!progressData.progress.paymentCompleted) {
            setError("You need to complete payment before taking the final test.")
            router.push("/payment")
            return
          }

          // Check if user is allowed to take the final test
          if (!progressData.progress.finalTestUnlocked) {
            setError("You need to complete all chapters before taking the final test.")
          }

          // Set default values
          setScore(0)
          setTotalQuestions(30)
        }
      } catch (err) {
        console.error("Failed to check user progress:", err)
        setError(err instanceof Error ? err.message : "Failed to check if you're eligible for the final test.")
        setScore(0)
        setTotalQuestions(0)
      } finally {
        setLoading(false)
      }
    }

    checkUserProgress()
  }, [user, router])

  // Function to save final test state to localStorage
  const saveTestState = () => {
    if (questions.length > 0 && !isSubmitted) {
      const testState = {
        currentQuestion,
        selectedAnswers,
        questions,
        timestamp: new Date().getTime()
      }
      localStorage.setItem('final-test-state', JSON.stringify(testState))
    }
  }

  // Function to restore final test state from localStorage
  const restoreTestState = () => {
    try {
      const savedState = localStorage.getItem('final-test-state')
      if (savedState) {
        const parsedState = JSON.parse(savedState)
        setQuestions(parsedState.questions)
        setSelectedAnswers(parsedState.selectedAnswers)
        setCurrentQuestion(parsedState.currentQuestion)
        return true // Successfully restored state
      }
    } catch (err) {
      console.error("Failed to restore final test state:", err)
    }
    return false // Failed to restore state
  }

  // Save test state whenever it changes
  useEffect(() => {
    if (showTestDialog && questions.length > 0 && !isSubmitted) {
      saveTestState()
    }
  }, [currentQuestion, selectedAnswers, questions, showTestDialog, isSubmitted])
  
  // Add event listener to save state before unload (page refresh/close)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (showTestDialog && questions.length > 0 && !isSubmitted) {
        saveTestState()
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [questions, isSubmitted, showTestDialog])

  const handleStartTest = async () => {
    if (!user) {
      router.push("/login")
      return
    }

    setShowTestDialog(true)
    setTestLoading(true)
    
    // Try to restore state first
    const stateRestored = restoreTestState()
    
    // If state was restored successfully, we don't need to fetch again
    if (stateRestored) {
      setTestLoading(false)
      return
    }
    
    setCurrentQuestion(0)
    setSelectedAnswers({})
    setIsSubmitted(false)

    try {
      // Fetch final test questions
      const fetchedQuestions = await fetchQuizQuestions("final-test")

      if (fetchedQuestions.length === 0) {
        setError("No questions found for the final test.")
      } else {
        setQuestions(fetchedQuestions)

        // Initialize selectedAnswers with empty values
        const initialAnswers: Record<string, string> = {}
        fetchedQuestions.forEach((q) => {
          initialAnswers[q.id] = ""
        })
        setSelectedAnswers(initialAnswers)
      }
    } catch (err) {
      console.error("Failed to load final test data:", err)
      setError("Failed to load final test. Please try again later.")
    } finally {
      setTestLoading(false)
    }
  }

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const handleSubmitTest = async () => {
    if (!user) {
      router.push("/login")
      return
    }

    try {
      // Submit answers to the backend for validation
      const response = await fetch(`/api/quiz/final-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userAnswers: selectedAnswers,
          userId: user.id,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      // Set the score from the server response
      setScore(result.analytics.score)
      setTotalQuestions(result.analytics.totalQuestionsAttempted)
      
      // The final test API now handles updating the user progress
      // Just update our local state based on the response
      setFinalTestCompleted(true)
      setCertificateUnlocked(result.certificateUnlocked || false)

      setIsSubmitted(true)
      setShowTestDialog(false)
      
      // Clear the saved test state since it's now completed
      localStorage.removeItem('final-test-state')
    } catch (err) {
      console.error("Failed to submit final test:", err)
      setError(err instanceof Error ? err.message : "Failed to submit final test. Please try again.")
    }
  }

  const isPassing = score !== null && totalQuestions !== null ? score >= passingScore : false

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Loading final test data...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Final Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Final Assessment</CardTitle>
          <CardDescription>Test your knowledge of all cybersecurity concepts covered in the course</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="flex items-center justify-center w-32 h-32 rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="text-center">
                <div className="text-3xl font-bold">{score}</div>
                <div className="text-sm text-muted-foreground">out of {totalQuestions}</div>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              {!isPassing ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>
                    Your score is below the passing threshold of {passingScore} points. You need to score at least{" "}
                    {passingScore} points to pass the final test and receive your certificate.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="bg-green-50 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-800">
                  <Trophy className="h-4 w-4" />
                  <AlertTitle>Congratulations!</AlertTitle>
                  <AlertDescription>
                    You have passed the final test. You can now download your certificate.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Your Score</span>
                  <span>{totalQuestions ? Math.round((score! / totalQuestions) * 100) : 0}%</span>
                </div>
                <Progress value={totalQuestions ? (score! / totalQuestions) * 100 : 0} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span
                    className={`${isPassing ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    Passing: {totalQuestions ? Math.round((passingScore / totalQuestions) * 100) : 0}%
                  </span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button className="flex-1" onClick={handleStartTest}>
            Take Test
          </Button>
          {isPassing && (
            <Button variant="outline" asChild className="flex-1">
              <Link href="/certificate">View Certificate</Link>
            </Button>
          )}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Summary</CardTitle>
          <CardDescription>Breakdown of your performance in the final test</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{score}</div>
                    <div className="text-sm text-muted-foreground">Correct Answers</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{totalQuestions !== null ? totalQuestions - score! : 0}</div>
                    <div className="text-sm text-muted-foreground">Incorrect Answers</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {totalQuestions ? Math.round((score! / totalQuestions) * 100) : 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">Accuracy</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Areas for Improvement</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Identity Theft Prevention (40% accuracy)</li>
                <li>Online Banking Security (50% accuracy)</li>
                <li>Social Media Privacy (60% accuracy)</li>
              </ul>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full">
            Review All Questions
          </Button>
        </CardFooter>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Access the Final Test</DialogTitle>
            <DialogDescription>
              You need to either apply a coupon code or make a payment to access the final test.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <Tabs defaultValue="coupon" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="coupon">Apply Coupon</TabsTrigger>
                <TabsTrigger value="payment">Make Payment</TabsTrigger>
              </TabsList>
              <TabsContent value="coupon" className="pt-4">
                <div className="space-y-4">
                  <h4 className="font-medium">Enter your coupon code</h4>
                  <CouponForm onCouponApplied={() => {
                    setShowPaymentDialog(false)
                    window.location.reload() // Reload to check eligibility again
                  }} />
                </div>
              </TabsContent>
              <TabsContent value="payment" className="pt-4">
                <div className="space-y-4">
                  <h4 className="font-medium">Select a payment method</h4>
                  <RadioGroup value={paymentMethod || ""} onValueChange={setPaymentMethod}>
                    <div className="flex items-center space-x-2 mb-3">
                      <RadioGroupItem value="credit-card" id="credit-card" />
                      <Label htmlFor="credit-card" className="flex items-center">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Credit Card
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="paypal" id="paypal" />
                      <Label htmlFor="paypal">PayPal</Label>
                    </div>
                  </RadioGroup>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between">
            <Button variant="outline" className="mb-2 sm:mb-0" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!paymentMethod}>
              Continue to Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Final Assessment</DialogTitle>
            <DialogDescription>
              Answer all questions to complete the final test. You can navigate between questions.
            </DialogDescription>
          </DialogHeader>

          {testLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">Loading questions...</p>
            </div>
          ) : questions.length > 0 ? (
            <div className="space-y-6 py-4">
              <div className="flex justify-between items-center">
                <div className="text-sm font-medium">
                  Question {currentQuestion + 1} of {questions.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  {Object.values(selectedAnswers).filter(Boolean).length} of {questions.length} answered
                </div>
              </div>

              <Progress
                value={(Object.values(selectedAnswers).filter(Boolean).length / questions.length) * 100}
                className="h-2"
              />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">{questions[currentQuestion].question}</h3>

                <RadioGroup
                  value={selectedAnswers[questions[currentQuestion].id] || ""}
                  onValueChange={(value) => {
                    setSelectedAnswers({
                      ...selectedAnswers,
                      [questions[currentQuestion].id]: value,
                    })
                  }}
                >
                  {Object.entries(questions[currentQuestion].options).map(([key, option], index) => (
                    <div key={index} className="flex items-center space-x-2 py-2">
                      <RadioGroupItem
                        value={option}
                        id={`option-${index}`}
                        disabled={isSubmitted}
                      />
                      <Label htmlFor={`option-${index}`}>{option}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentQuestion === 0}
                  className="flex items-center"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                {currentQuestion < questions.length - 1 ? (
                  <Button onClick={handleNext} className="flex items-center">
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmitTest}
                    disabled={Object.values(selectedAnswers).some((answer) => !answer)}
                  >
                    Submit Test
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>No questions available for the final test.</AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}