import { useState } from "react";
import { useRoute } from "wouter";
import { 
  useGetProject, 
  useListProjectTasks, 
  useCreateTask, 
  useUpdateTask, 
  useDeleteTask,
  useListUsers,
  useUpdateProject,
  useDeleteProject
} from "@workspace/api-client-react";
import { 
  getGetProjectQueryKey, 
  getListProjectTasksQueryKey,
  getListProjectsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  FolderKanban,
  Plus,
  MoreVertical,
  CheckCircle2,
  Clock,
  CircleDashed,
  Calendar,
  User,
  Loader2,
  Trash2,
  Pencil,
  ArrowLeft,
  Settings
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().default(""),
  status: z.enum(["pending", "in_progress", "completed"]).default("pending"),
  dueDate: z.string().optional().nullable(),
  assigneeId: z.coerce.number().optional().nullable(),
});

type CreateTaskValues = z.infer<typeof createTaskSchema>;

const editProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().default(""),
});

type EditProjectValues = z.infer<typeof editProjectSchema>;

const statusConfig = {
  pending: { label: "Pending", icon: CircleDashed, color: "text-muted-foreground", badge: "secondary" },
  in_progress: { label: "In Progress", icon: Clock, color: "text-primary", badge: "default" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-green-500", badge: "outline" },
};

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:projectId");
  const projectId = parseInt(params?.projectId || "0");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project, isLoading: isLoadingProject } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  const { data: tasks, isLoading: isLoadingTasks } = useListProjectTasks(projectId, {
    query: { enabled: !!projectId, queryKey: getListProjectTasksQueryKey(projectId) },
  });
  
  const { data: users } = useListUsers();

  const deleteProjectMutation = useDeleteProject({
      mutation: {
          onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
              toast({ title: "Project deleted" });
              setLocation("/projects");
          }
      }
  })

  const updateTaskMutation = useUpdateTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectTasksQueryKey(projectId) });
      }
    }
  });

  const deleteTaskMutation = useDeleteTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectTasksQueryKey(projectId) });
        toast({ title: "Task deleted" });
      }
    }
  });

  const isAdmin = user?.role === 'admin';

  if (isLoadingProject || isLoadingTasks) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-24 mb-4" />
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3 mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-2xl font-bold mb-2">Project not found</h2>
        <p className="text-muted-foreground mb-6">The project you are looking for does not exist or you don't have access to it.</p>
        <Link href="/projects">
          <Button>Back to Projects</Button>
        </Link>
      </div>
    );
  }

  const pendingTasks = tasks?.filter((t) => t.status === 'pending') || [];
  const inProgressTasks = tasks?.filter((t) => t.status === 'in_progress') || [];
  const completedTasks = tasks?.filter((t) => t.status === 'completed') || [];

  return (
    <div className="space-y-8 h-[calc(100vh-8rem)] flex flex-col">
      <div>
        <Link href="/projects" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              {project.description || "No description provided."}
            </p>
            <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                    {project.members?.slice(0, 3).map((member) => (
                        <Avatar key={member.id} className="h-6 w-6 border-2 border-background">
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                            {member.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    ))}
                    </div>
                    <span className="text-muted-foreground">
                        {project.members?.length || 0} members
                    </span>
                </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <CreateTaskDialog projectId={projectId} users={users || []} />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                            <Settings className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <EditProjectDialog project={project} />
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                                if (confirm("Are you sure you want to delete this project?")) {
                                    deleteProjectMutation.mutate({ projectId });
                                }
                            }}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Project
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 grid gap-6 md:grid-cols-3 overflow-hidden min-h-0">
        <TaskColumn 
          title="Pending" 
          tasks={pendingTasks} 
          status="pending" 
          icon={CircleDashed}
          projectId={projectId}
          users={users || []}
          isAdmin={isAdmin}
          currentUser={user}
          updateTask={updateTaskMutation}
          deleteTask={deleteTaskMutation}
        />
        <TaskColumn 
          title="In Progress" 
          tasks={inProgressTasks} 
          status="in_progress" 
          icon={Clock}
          projectId={projectId}
          users={users || []}
          isAdmin={isAdmin}
          currentUser={user}
          updateTask={updateTaskMutation}
          deleteTask={deleteTaskMutation}
        />
        <TaskColumn 
          title="Completed" 
          tasks={completedTasks} 
          status="completed" 
          icon={CheckCircle2}
          projectId={projectId}
          users={users || []}
          isAdmin={isAdmin}
          currentUser={user}
          updateTask={updateTaskMutation}
          deleteTask={deleteTaskMutation}
        />
      </div>
    </div>
  );
}

function TaskColumn({ 
  title, 
  tasks, 
  status, 
  icon: Icon,
  projectId,
  users,
  isAdmin,
  currentUser,
  updateTask,
  deleteTask
}: { 
  title: string, 
  tasks: any[], 
  status: string, 
  icon: any,
  projectId: number,
  users: any[],
  isAdmin: boolean,
  currentUser: any,
  updateTask: any,
  deleteTask: any
}) {
  return (
    <div className="flex flex-col bg-muted/30 rounded-lg p-4 h-full border overflow-hidden min-h-[300px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Icon className={cn("h-4 w-4", statusConfig[status as keyof typeof statusConfig].color)} />
          {title}
          <Badge variant="secondary" className="ml-1 rounded-full h-5 px-1.5 min-w-[20px] flex items-center justify-center text-xs">
            {tasks.length}
          </Badge>
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 pb-2">
        {tasks.map((task) => {
            const isAssignedToMe = task.assigneeId === currentUser?.id;
            const canChangeStatus = isAdmin || isAssignedToMe;
            
            const isOverdue = task.dueDate && task.status !== 'completed' && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate));
            const isDueSoon = task.dueDate && task.status !== 'completed' && !isOverdue && (isToday(new Date(task.dueDate)) || isTomorrow(new Date(task.dueDate)));

            return (
                <Card key={task.id} className={cn("hover-elevate transition-all", isOverdue ? "border-destructive/50 bg-destructive/5" : "")}>
                <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 w-full pr-6 relative">
                        <h4 className={cn("font-medium text-sm leading-tight", task.status === 'completed' && "line-through text-muted-foreground")}>
                            {task.title}
                        </h4>
                        {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                        </p>
                        )}
                        
                        {(canChangeStatus || isAdmin) && (
                            <div className="absolute top-0 right-0">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 -mt-2">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {canChangeStatus && (
                                            <>
                                                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Move to</div>
                                                <DropdownMenuItem onClick={() => updateTask.mutate({ taskId: task.id, data: { status: 'pending' } })} disabled={task.status === 'pending'}>
                                                    <CircleDashed className="h-4 w-4 mr-2" /> Pending
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => updateTask.mutate({ taskId: task.id, data: { status: 'in_progress' } })} disabled={task.status === 'in_progress'}>
                                                    <Clock className="h-4 w-4 mr-2" /> In Progress
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => updateTask.mutate({ taskId: task.id, data: { status: 'completed' } })} disabled={task.status === 'completed'}>
                                                    <CheckCircle2 className="h-4 w-4 mr-2" /> Completed
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                        
                                        {isAdmin && (
                                            <>
                                                {canChangeStatus && <DropdownMenuSeparator />}
                                                <EditTaskDialog task={task} users={users} projectId={projectId} />
                                                <DropdownMenuItem 
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => {
                                                        if (confirm("Are you sure?")) {
                                                            deleteTask.mutate({ taskId: task.id });
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                            {task.dueDate && (
                                <Badge variant="outline" className={cn("text-[10px] px-1.5 h-5 font-normal flex items-center gap-1", 
                                    isOverdue ? "border-destructive text-destructive" : 
                                    isDueSoon ? "border-orange-500 text-orange-600" : ""
                                )}>
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(task.dueDate), "MMM d")}
                                </Badge>
                            )}
                            {isOverdue && <Badge variant="destructive" className="text-[10px] px-1.5 h-5">Overdue</Badge>}
                        </div>
                        {task.assignee ? (
                            <Avatar className="h-6 w-6">
                                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                                    {task.assignee.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        ) : (
                            <div className="h-6 w-6 rounded-full border border-dashed flex items-center justify-center text-muted-foreground bg-muted/50">
                                <User className="h-3 w-3" />
                            </div>
                        )}
                    </div>
                </CardContent>
                </Card>
            )
        })}
        {tasks.length === 0 && (
          <div className="h-24 border border-dashed rounded-lg flex items-center justify-center text-sm text-muted-foreground">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

function CreateTaskDialog({ projectId, users }: { projectId: number, users: any[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<CreateTaskValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "pending",
      dueDate: "",
      assigneeId: undefined,
    },
  });

  const createMutation = useCreateTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectTasksQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        toast({
          title: "Task created",
        });
        setOpen(false);
        form.reset();
      },
      onError: (error: any) => {
        toast({
          title: "Failed to create task",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  });

  const onSubmit = (data: CreateTaskValues) => {
    createMutation.mutate({ 
        data: {
            title: data.title,
            description: data.description,
            status: data.status,
            dueDate: data.dueDate || null,
            assigneeId: data.assigneeId || null,
            projectId: projectId
        } as any
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>
            Create a new task for this project.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Design homepage" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="More details about the task..." 
                      className="resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Assignee</FormLabel>
                    <Select 
                        onValueChange={(v) => field.onChange(v === "none" ? null : parseInt(v))} 
                        defaultValue={field.value ? String(field.value) : "none"}
                    >
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {users?.map(u => (
                            <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Task
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditTaskDialog({ task, users, projectId }: { task: any, users: any[], projectId: number }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<CreateTaskValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: task.title,
      description: task.description || "",
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : "",
      assigneeId: task.assigneeId || undefined,
    },
  });

  const updateMutation = useUpdateTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectTasksQueryKey(projectId) });
        toast({ title: "Task updated" });
        setOpen(false);
      },
      onError: (error: any) => {
        toast({
          title: "Failed to update task",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  });

  const onSubmit = (data: CreateTaskValues) => {
    updateMutation.mutate({ 
        taskId: task.id,
        data: {
            title: data.title,
            description: data.description,
            status: data.status,
            dueDate: data.dueDate || null,
            assigneeId: data.assigneeId || null,
        }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <Pencil className="mr-2 h-4 w-4" /> Edit Task
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update task details.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Design homepage" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="More details about the task..." 
                      className="resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Assignee</FormLabel>
                    <Select 
                        onValueChange={(v) => field.onChange(v === "none" ? null : parseInt(v))} 
                        defaultValue={field.value ? String(field.value) : "none"}
                    >
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {users?.map(u => (
                            <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditProjectDialog({ project }: { project: any }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<EditProjectValues>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: {
      name: project.name,
      description: project.description || "",
    },
  });

  const updateMutation = useUpdateProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(project.id) });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Project updated" });
        setOpen(false);
      },
      onError: (error: any) => {
        toast({
          title: "Failed to update project",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  });

  const onSubmit = (data: EditProjectValues) => {
    updateMutation.mutate({ 
        projectId: project.id,
        data: {
            name: data.name,
            description: data.description,
        }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <Pencil className="mr-2 h-4 w-4" /> Edit Project
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update project details.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Project Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Description..." 
                      className="resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}