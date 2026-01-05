import React, { useState } from 'react';
import { MoreHorizontal, Eye, Ban, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAdminTranslations } from '../hooks/useAdminTranslations';
import { sanitizeDisplayName } from '../utils/sanitize';

interface UserActionsMenuProps {
  userId: string;
  displayName: string | null;
  isBanned: boolean;
  onViewDetails: () => void;
  onBanToggle: (userId: string, shouldBan: boolean) => Promise<void>;
  onDelete: (userId: string) => Promise<void>;
}

export function UserActionsMenu({
  userId,
  displayName,
  isBanned,
  onViewDetails,
  onBanToggle,
  onDelete,
}: UserActionsMenuProps) {
  const { t } = useAdminTranslations();
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const userName = sanitizeDisplayName(displayName, userId.slice(0, 8) + '...');

  const handleBanToggle = async () => {
    setIsLoading(true);
    try {
      await onBanToggle(userId, !isBanned);
    } finally {
      setIsLoading(false);
      setBanDialogOpen(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await onDelete(userId);
    } finally {
      setIsLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Actions for ${sanitizeDisplayName(displayName, 'user ' + userId.slice(0, 8))}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onViewDetails}>
            <Eye className="mr-2 h-4 w-4" />
            {t('admin.users.actions.viewDetails')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setBanDialogOpen(true)}>
            <Ban className="mr-2 h-4 w-4" />
            {isBanned
              ? t('admin.users.actions.unban')
              : t('admin.users.actions.ban')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t('admin.users.actions.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Ban/Unban Confirmation Dialog */}
      <AlertDialog
        open={banDialogOpen}
        onOpenChange={(open) => {
          if (!isLoading) setBanDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isBanned
                ? t('admin.users.confirmUnban.title')
                : t('admin.users.confirmBan.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBanned
                ? t('admin.users.confirmUnban.description')
                : t('admin.users.confirmBan.description')}
              <br />
              <span className="font-medium">{userName}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>
              {t('admin.common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBanToggle}
              disabled={isLoading}
              className={isBanned ? '' : 'bg-destructive hover:bg-destructive/90'}
            >
              {isLoading
                ? t('admin.common.loading')
                : isBanned
                  ? t('admin.users.confirmUnban.confirm')
                  : t('admin.users.confirmBan.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!isLoading) setDeleteDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.users.confirmDelete.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.users.confirmDelete.description')}
              <br />
              <span className="font-medium">{userName}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>
              {t('admin.common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isLoading
                ? t('admin.common.loading')
                : t('admin.users.confirmDelete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
