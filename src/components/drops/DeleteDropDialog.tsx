import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { buildEraseDropActions } from "@/lib/drops";
import { useWax } from "@/context/WaxContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";

interface DeleteDropDialogProps {
  dropId: number;
  dropName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteDropDialog({ dropId, dropName, open, onOpenChange }: DeleteDropDialogProps) {
  const { accountName, session } = useWax();
  const queryClient = useQueryClient();
  const { executeTransaction } = useWaxTransaction(session);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    if (!accountName) return;
    setIsLoading(true);
    try {
      const actions = buildEraseDropActions(accountName, dropId);
      await executeTransaction(actions, { successTitle: 'Drop Deleted' });
      queryClient.invalidateQueries({ queryKey: ['userDrops', accountName] });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete drop:', error);
      toast.error('Failed to delete drop');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Drop</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>"{dropName}"</strong> (Drop #{dropId})?
            This action is irreversible and cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Deleting..." : "Delete Drop"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
