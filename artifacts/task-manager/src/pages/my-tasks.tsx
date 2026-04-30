import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListMyTasks, useUpdateTask } from "@workspace/api-client-react";
import { getListMyTasksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import {
  CheckSquare,
  CircleDashed,
  Clock,
  CheckCircle2,
  Calendar,
  FolderKanban,
  Filter,
  Loader2
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const statusConfig = {
  pending: { label: "Pending", icon: CircleDashed, color: "text-muted-foreground" },
  in_progress: { label: "In Progress", icon: Clock, color: "text-primary" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-green-500" },
};

export default function MyTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: tasks, isLoading } = useListMyTasks();

  const updateTaskMutation = useUpdateTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMyTasksQueryKey() });
        toast({ title: "Task status updated" });
      }
    }
  });

  const filteredTasks = useMemo(() => {
      if (!tasks) return [];
      if (statusFilter === "all") return tasks;
      return tasks.filter(t => t.status === statusFilter);
  }, [tasks, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-1/3 mb-2" />
                <Skeleton className="h-4 w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CheckSquare className="h-8 w-8 text-primary" />
            My Tasks
          </h1>
          <p className="text-muted-foreground">Tasks assigned specifically to you.</p>
        </div>
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md border">
                <Filter className="h-4 w-4 text-muted-foreground ml-2" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px] h-8 border-0 bg-transparent shadow-none focus:ring-0">
                        <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
      </div>

      {!filteredTasks || filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg border-dashed">
          <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <CheckSquare className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No tasks found</h2>
          <p className="text-muted-foreground max-w-sm">
            {statusFilter === "all" 
                ? "You don't have any tasks assigned to you right now." 
                : `You don't have any ${statusConfig[statusFilter as keyof typeof statusConfig].label.toLowerCase()} tasks.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTasks.map((task) => {
            const StatusIcon = statusConfig[task.status as keyof typeof statusConfig].icon;
            
            const isOverdue = task.dueDate && task.status !== 'completed' && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate));
            const isDueSoon = task.dueDate && task.status !== 'completed' && !isOverdue && (isToday(new Date(task.dueDate)) || isTomorrow(new Date(task.dueDate)));

            return (
              <Card key={task.id} className={cn("hover-elevate transition-all", isOverdue ? "border-destructive/50 bg-destructive/5" : "")}>
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/projects/${task.projectId}`} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                        <FolderKanban className="h-3 w-3" />
                        {task.projectName}
                      </Link>
                    </div>
                    <h3 className={cn("font-semibold text-lg leading-tight", task.status === 'completed' && "line-through text-muted-foreground")}>
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {task.description}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                        {task.dueDate && (
                            <Badge variant="outline" className={cn("text-xs font-normal flex items-center gap-1.5", 
                                isOverdue ? "border-destructive text-destructive" : 
                                isDueSoon ? "border-orange-500 text-orange-600" : ""
                            )}>
                                <Calendar className="h-3.5 w-3.5" />
                                {format(new Date(task.dueDate), "MMM d, yyyy")}
                            </Badge>
                        )}
                        {isOverdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
                        {isDueSoon && <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/30">Due Soon</Badge>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className={cn("w-[140px] justify-between", task.status === 'completed' ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : "")}>
                                <div className="flex items-center gap-2 truncate">
                                    <StatusIcon className={cn("h-4 w-4 shrink-0", statusConfig[task.status as keyof typeof statusConfig].color)} />
                                    <span className="truncate">{statusConfig[task.status as keyof typeof statusConfig].label}</span>
                                </div>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateTaskMutation.mutate({ taskId: task.id, data: { status: 'pending' } })} disabled={task.status === 'pending' || updateTaskMutation.isPending}>
                                <CircleDashed className="h-4 w-4 mr-2" /> Pending
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateTaskMutation.mutate({ taskId: task.id, data: { status: 'in_progress' } })} disabled={task.status === 'in_progress' || updateTaskMutation.isPending}>
                                <Clock className="h-4 w-4 mr-2" /> In Progress
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateTaskMutation.mutate({ taskId: task.id, data: { status: 'completed' } })} disabled={task.status === 'completed' || updateTaskMutation.isPending}>
                                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> Completed
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}