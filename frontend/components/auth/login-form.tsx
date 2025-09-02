'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, User, Lock } from 'lucide-react'

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<boolean>
  onRegister: (username: string, password: string) => Promise<boolean>
}

export function LoginForm({ onLogin, onRegister }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('login')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const success = activeTab === 'login'
        ? await onLogin(username, password)
        : await onRegister(username, password)
      
      if (!success) {
        setError(activeTab === 'login' ? 'Invalid credentials' : 'Registration failed')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setUsername('')
    setPassword('')
    setError('')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground font-sans mb-2">minaturn</h1>
          <p className="text-muted-foreground text-lg">Smarter Queuing for a More Efficient South Africa</p>
        </div>

        <Card className="border-2 border-border bg-card shadow-2xl p-2">
          <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value)
            resetForm()
          }}>
            <TabsList className="grid w-full grid-cols-2 bg-muted border-2 border-border shadow-sm mb-8">
              <TabsTrigger 
                value="login" 
                className="text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground border-2 border-transparent data-[state=active]:border-border data-[state=active]:shadow font-mono font-bold"
              >
                SIGN IN
              </TabsTrigger>
              <TabsTrigger 
                value="register"
                className="text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground border-2 border-transparent data-[state=active]:border-border data-[state=active]:shadow font-mono font-bold"
              >
                REGISTER
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-0">
              <form onSubmit={handleSubmit}>
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl text-card-foreground font-sans">Welcome back</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Sign in to manage your queues
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username" className="text-card-foreground">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="pl-10 bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:border-ring focus:shadow font-mono"
                        placeholder="Enter your username"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <Label htmlFor="login-password" className="text-card-foreground">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:border-ring focus:shadow font-mono"
                        placeholder="Enter your password"
                        required
                      />
                    </div>
                  </div>
                  {error && (
                    <Alert className="bg-destructive/10 border-2 border-destructive text-destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 border-2 border-border shadow hover:shadow-lg font-mono font-bold uppercase tracking-wider mb-8"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        SIGNING IN...
                      </>
                    ) : (
                      'SIGN IN'
                    )}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="register" className="space-y-0">
              <form onSubmit={handleSubmit}>
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl text-card-foreground font-sans">Create account</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Join to start managing queues
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username" className="text-card-foreground">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="pl-10 bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:border-ring focus:shadow font-mono"
                        placeholder="Choose a username"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <Label htmlFor="register-password" className="text-card-foreground">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:border-ring focus:shadow font-mono"
                        placeholder="Create a password"
                        required
                      />
                    </div>
                  </div>
                  {error && (
                    <Alert className="bg-destructive/10 border-2 border-destructive text-destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 border-2 border-border shadow hover:shadow-lg font-mono font-bold uppercase tracking-wider mb-8"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        CREATING ACCOUNT...
                      </>
                    ) : (
                      'CREATE ACCOUNT'
                    )}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}