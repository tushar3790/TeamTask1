import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Target, Loader2, Mail, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useLogin();

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const response = await loginMutation.mutateAsync({ data });
      login(response.token, response.user);
      toast({
        title: "Welcome back",
        description: "You have successfully logged in.",
      });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="flex items-center gap-2 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Target className="h-6 w-6" />
            </div>
            <span className="font-bold tracking-tight text-2xl">
              TaskForce
            </span>
          </div>

          <Card className="border-none shadow-none sm:border-solid sm:shadow-sm">
            <CardHeader className="px-0 sm:px-6">
              <CardTitle className="text-2xl font-bold tracking-tight">Sign in to your account</CardTitle>
              <CardDescription>
                Or <Link href="/signup" className="text-primary hover:underline font-medium">create a new account</Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="name@company.com" className="pl-10" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="password" placeholder="••••••••" className="pl-10" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                    {loginMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Sign in
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="hidden lg:block relative w-0 flex-1 bg-muted">
        <div className="absolute inset-0 h-full w-full object-cover bg-gradient-to-br from-primary/20 via-primary/10 to-background flex items-center justify-center p-12">
            <div className="max-w-2xl text-center space-y-6">
                <h2 className="text-4xl font-bold tracking-tight text-foreground">
                    Clarity over decoration.
                </h2>
                <p className="text-lg text-muted-foreground">
                    The modern team task manager for small teams. Know exactly who's doing what, what's slipping, and what's done.
                </p>
                <div className="grid grid-cols-2 gap-4 text-left mt-12">
                    <Card className="bg-background/60 backdrop-blur border-primary/20">
                        <CardHeader>
                            <CardTitle className="text-primary flex items-center gap-2">
                                <Target className="h-5 w-5" />
                                Focused
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Built for speed and clarity. No unnecessary features to slow you down.
                        </CardContent>
                    </Card>
                    <Card className="bg-background/60 backdrop-blur border-primary/20">
                        <CardHeader>
                            <CardTitle className="text-primary flex items-center gap-2">
                                <CheckSquare className="h-5 w-5" />
                                Actionable
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            See overdue tasks at a glance and keep your team aligned.
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

import { CheckSquare } from "lucide-react";