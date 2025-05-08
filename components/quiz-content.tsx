"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ChevronLeft, ChevronRight, AlertCircle, Loader2, CheckCircle, XCircle } from "lucide-react" // Added CheckCircle, XCircle
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/lib/auth-context" // Import useAuth hook
import { useProgress } from "@/lib/progress-context" // Import useProgress hook
import { type QuizQuestion } from "@/lib/quiz-service" // Keep QuizQuestion type if needed

// Define the structure of the analytics object received from the backend
interface QuizAnalytics {
  chapterId: string;
  userId: string;
  score: number;
  totalQuestionsAttempted: number;
  submittedAt: string;
  // evaluationDetails?: Record<string, { userAnswer: string; correctAnswer: string; isCorrect: boolean }>; // Optional
}

interface QuizContentProps {
  chapterId: string
}

export function QuizContent({ chapterId }: QuizContentProps) {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth() // Get user and auth loading state
  const { refreshProgress } = useProgress() // Get refreshProgress function from progress context
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [quizAnalytics, setQuizAnalytics] = useState<QuizAnalytics | null>(null) // Store analytics from backend
  const [loading, setLoading] = useState(true) // Loading state for fetching questions
  const [submitting, setSubmitting] = useState(false); // Loading state for submitting answers
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [stateRestored, setStateRestored] = useState(false)

  // Format chapter ID for API endpoint (e.g., "1" -> "CH-001")
  const chapter = `CH-${chapterId.padStart(3, "0")}`

  // Function to save quiz state to localStorage
  const saveQuizState = () => {
    if (questions.length > 0) {
      const quizState = {
        currentQuestionIndex,
        selectedAnswers,
        questions,
        chapter,
        timestamp: new Date().getTime()
      }
      localStorage.setItem(`quiz-state-${chapter}`, JSON.stringify(quizState))
    }
  }

  // Function to restore quiz state from localStorage
  const restoreQuizState = () => {
    try {
      const savedState = localStorage.getItem(`quiz-state-${chapter}`)
      if (savedState) {
        const parsedState = JSON.parse(savedState)
        
        // Only restore if it's the same chapter
        if (parsedState.chapter === chapter) {
          // Check if the saved state is not too old (24 hours max)
          const savedTime = parsedState.timestamp || 0
          const currentTime = new Date().getTime()
          const maxAge = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
          
          if (currentTime - savedTime <= maxAge) {
            setQuestions(parsedState.questions)
            setSelectedAnswers(parsedState.selectedAnswers)
            setCurrentQuestionIndex(parsedState.currentQuestionIndex)
            setStateRestored(true) // Mark that state was restored
            return true // Successfully restored state
          } else {
            // State is too old, remove it
            localStorage.removeItem(`quiz-state-${chapter}`)
            console.log("Quiz state was too old and has been removed")
          }
        }
      }
    } catch (err) {
      console.error("Failed to restore quiz state:", err)
    }
    return false // Failed to restore state
  }

  // Save quiz state whenever it changes
  useEffect(() => {
    if (!isSubmitted && questions.length > 0) {
      saveQuizState()
    }
  }, [currentQuestionIndex, selectedAnswers, questions, chapter, isSubmitted])
  
  // Add event listener to save state before unload (page refresh/close)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!isSubmitted && questions.length > 0) {
        saveQuizState()
      }
    }
    
    // Save state before page unload/refresh
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    // Also handle page visibility changes (tab switching, minimizing)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !isSubmitted && questions.length > 0) {
        saveQuizState()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Set up auto-save at regular intervals (every 30 seconds)
    const autoSaveInterval = setInterval(() => {
      if (!isSubmitted && questions.length > 0) {
        saveQuizState()
        console.log('Quiz state auto-saved')
      }
    }, 30000) // 30 seconds
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(autoSaveInterval)
    }
  }, [questions, isSubmitted])

  // Fetch quiz questions from the backend API
  useEffect(() => {
    async function loadQuizData() {
      setLoading(true)
      setError(null)
      
      // Try to restore state first
      const stateRestored = restoreQuizState()
      
      // If state was restored successfully, we don't need to fetch again
      if (stateRestored) {
        setLoading(false)
        return
      }
      
      try {
        const response = await fetch(`/api/quiz/${chapter}`) // Fetch from GET endpoint
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json()

        if (!data.questions || data.questions.length === 0) {
          setError("No questions found for this chapter.")
          setQuestions([])
        } else {
          setQuestions(data.questions)
          // Initialize selectedAnswers based on fetched questions
          const initialAnswers: Record<string, string> = {}
          data.questions.forEach((q: QuizQuestion) => {
            initialAnswers[q.id] = ""
          })
          setSelectedAnswers(initialAnswers)
        }
      } catch (err: any) {
        console.error("Failed to load quiz data:", err)
        setError(err.message || "Failed to load quiz. Please try again later.")
        setQuestions([]) // Clear questions on error
      } finally {
        setLoading(false)
      }
    }

    loadQuizData()
  }, [chapter]) // Re-fetch if chapter changes

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  // Handle submitting answers to the backend API
  const handleSubmit = async () => {
    console.log("Submitting answers:", selectedAnswers);
    
    if (!user) {
      setError("You must be logged in to submit the quiz.");
      return; // Or redirect to login
    }
    if (Object.values(selectedAnswers).some((answer) => !answer)) {
        setError("Please answer all questions before submitting.");
        return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/quiz/${chapter}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          
          userAnswers: selectedAnswers,
          userId: user.id, // Send the user ID from auth context
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      // Store the analytics received from the backend
      setQuizAnalytics(result.analytics);
      setIsSubmitted(true);
      
      // Clear the saved quiz state since it's now completed
      localStorage.removeItem(`quiz-state-${chapter}`);
            
      // Refresh the progress context to update the sidebar
      refreshProgress();
      console.log("Progress refreshed after quiz submission");

    } catch (err: any) {
      console.error("Failed to submit quiz:", err);
      setError(err.message || "Failed to submit quiz. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Render States ---

  // Loading authentication state
  if (authLoading) {
     return (
      <Card className="max-w-3xl mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">Checking authentication...</p>
        </CardContent>
      </Card>
    )
  }

  // Loading questions state
  if (loading) {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">Loading quiz questions...</p>
        </CardContent>
      </Card>
    )
  }

  // Error state (fetch or submit)
  if (error && !submitting) { // Don't show fetch error if submitting error occurs
    return (
      <Card className="max-w-3xl mx-auto">
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button className="mt-6" onClick={() => router.back()}> {/* Use router.back() */}
            Go Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Submitted state - Display results from backend analytics
  if (isSubmitted && quizAnalytics) {
    const { score, totalQuestionsAttempted } = quizAnalytics;
    const totalQuestionsInQuiz = questions.length; // Use the length of fetched questions

    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Quiz Results</CardTitle>
          <CardDescription>Chapter {chapterId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center p-6 bg-muted rounded-lg">
            <h2 className="text-3xl font-bold mb-2">Your Score</h2>
            {/* Display score based on analytics */}
            <div className="text-5xl font-bold mb-4">
              {score}/{totalQuestionsInQuiz} {/* Show score out of total questions */}
            </div>
            <p className="text-muted-foreground">
              {score >= totalQuestionsInQuiz * 0.3 // 30% passing threshold
                ? "Great job! You've passed this chapter's quiz."
                : "You need to score at least 30% to pass. Consider reviewing the chapter and trying again."}
            </p>
             <p className="text-sm text-muted-foreground mt-2">Attempted: {totalQuestionsAttempted} questions</p>
          </div>

          {/* Optional: Display detailed evaluation if sent from backend and needed */}
          {/* {quizAnalytics.evaluationDetails && ( ... display logic ... )} */}

        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.push(`/chapters/${chapterId}`)}>
            Back to Chapter
          </Button>
          <Button
            onClick={() => {
              // Reset state for retake
              setIsSubmitted(false)
              setQuizAnalytics(null)
              setCurrentQuestionIndex(0)
              const resetAnswers: Record<string, string> = {}
              questions.forEach((q) => {
                resetAnswers[q.id] = ""
              })
              setSelectedAnswers(resetAnswers)
              setError(null) // Clear previous errors
              
              // Clear any saved state for this quiz
              localStorage.removeItem(`quiz-state-${chapter}`)
            }}
          >
            Retake Quiz
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // If no questions loaded (and not loading/error)
  if (!loading && questions.length === 0 && !error) {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardContent className="py-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No questions available for this chapter.</AlertDescription>
          </Alert>
          <Button className="mt-6" onClick={() => router.back()}>
            Go Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  // --- Quiz Taking UI ---
  const currentQuestionData = questions[currentQuestionIndex];
  if (!currentQuestionData) return null; // Should not happen if questions array is checked, but good practice

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Take a Quiz</CardTitle>
            <CardDescription>Chapter {chapterId}</CardDescription>
          </div>
          <div className="text-sm font-medium">
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="select-none">
          {/* Display submission error if any */}
          {error && submitting && (
             <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
             </Alert>
          )}
          
          {/* Display state restored notification */}
          {stateRestored && (
            <Alert className="mb-4 bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:border-blue-800">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your previous quiz progress has been restored. You can continue from where you left off.
              </AlertDescription>
            </Alert>
          )}
          
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Select an answer to proceed. You can navigate between questions before submitting.
            </AlertDescription>
          </Alert>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">
                {currentQuestionIndex + 1}. {currentQuestionData.question}
              </h3>

              <RadioGroup
                value={selectedAnswers[currentQuestionData.id] || ""}
                onValueChange={(value) => {
                  setSelectedAnswers((prev) => ({
                    ...prev,
                    [currentQuestionData.id]: value,
                  }))
                }}
                className="space-y-3"
              >
                {Object.entries(currentQuestionData.options)
                  .sort() // Keep sorting if needed
                  .map(([optionKey, optionText]) => (
                    <div
                      key={optionKey}
                      className={`flex items-center space-x-2 rounded-lg border p-4 cursor-pointer transition-colors ${
                        selectedAnswers[currentQuestionData.id] === optionKey ? "bg-muted border-primary" : "hover:bg-muted/50" // Enhanced styling
                      }`}
                      onClick={() => {
                        setSelectedAnswers((prev) => ({
                          ...prev,
                          [currentQuestionData.id]: optionKey,
                        }))
                      }}
                    >
                      <RadioGroupItem value={optionKey} id={`option-${optionKey}`} />
                      <Label htmlFor={`option-${optionKey}`} className="flex-1 cursor-pointer text-base">
                        {optionKey}: {optionText}
                      </Label>
                    </div>
                  ))}
              </RadioGroup>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <Button variant="outline" onClick={handleNext} disabled={currentQuestionIndex === questions.length - 1}>
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
        <Button
            onClick={handleSubmit}
            disabled={submitting || Object.values(selectedAnswers).some((answer) => !answer)} // Disable while submitting or if not all answered
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {submitting ? "Submitting..." : "Submit"}
        </Button>
      </CardFooter>
    </Card>
  )
}