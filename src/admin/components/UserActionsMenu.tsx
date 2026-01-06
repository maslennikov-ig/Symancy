import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Eye, Ban, Trash2, Shield, ShieldOff } from 'lucide-react';
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
import { supabase } from '@/lib/supabaseClient';
import { useAdminTranslations } from '../hooks/useAdminTranslations';
import { sanitizeDisplayName } from '../utils/sanitize';
import { logger } from '../utils/logger';

interface UserActionsMenuProps {
  userId: string;
  displayName: string | null;
  isBanned: boolean;
  onViewDetails: () => void;
  onBanToggle: (userId: string, shouldBan: boolean) => Promise<void>;
  onDelete: (userId: string) => Promise<void>;
  onAdminToggle?: (userId: string, email: string, shouldGrant: boolean) => Promise<void>;
}

export function UserActionsMenu({
  userId,
  displayName,
  isBanned,
  onViewDetails,
  onBanToggle,
  onDelete,
  onAdminToggle,
}: UserActionsMenuProps) {
  const { t } = useAdminTranslations();
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Admin status for this user (loaded on menu open)
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [adminStatusLoading, setAdminStatusLoading] = useState(false);

  const userName = sanitizeDisplayName(displayName, userId.slice(0, 8) + '...');

  // Load admin status when menu opens
  useEffect(() => {
    if (!menuOpen || !onAdminToggle) return;

    let cancelled = false;
    setAdminStatusLoading(true);

    async function loadAdminStatus() {
      try {
        const { data, error } = await supabase.rpc('admin_get_user_admin_status', {
          p_unified_user_id: userId,
        });

        if (error) {
          logger.error('Error loading admin status', error);
          return;
        }

        if (!cancelled && data && data.length > 0) {
          setUserEmail(data[0].email);
          setIsUserAdmin(data[0].is_admin);
        }
      } catch (err) {
        logger.error('Error loading admin status', err);
      } finally {
        if (!cancelled) {
          setAdminStatusLoading(false);
        }
      }
    }

    loadAdminStatus();
    return () => { cancelled = true; };
  }, [menuOpen, userId, onAdminToggle]);

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

  const handleAdminToggle = async () => {
    if (!onAdminToggle || !userEmail) return;
    setIsLoading(true);
    try {
      await onAdminToggle(userId, userEmail, !isUserAdmin);
      setIsUserAdmin(!isUserAdmin);
    } finally {
      setIsLoading(false);
      setAdminDialogOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
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
          {/* Admin toggle - only show for web users with email */}
          {onAdminToggle && userEmail && !adminStatusLoading && (
            <DropdownMenuItem onClick={() => setAdminDialogOpen(true)}>
              {isUserAdmin ? (
                <>
                  <ShieldOff className="mr-2 h-4 w-4" />
                  {t('admin.users.actions.revokeAdmin')}
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  {t('admin.users.actions.grantAdmin')}
                </>
              )}
            </DropdownMenuItem>
          )}
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

      {/* Admin Grant/Revoke Confirmation Dialog */}
      <AlertDialog
        open={adminDialogOpen}
        onOpenChange={(open) => {
          if (!isLoading) setAdminDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isUserAdmin
                ? t('admin.users.confirmRevokeAdmin.title')
                : t('admin.users.confirmGrantAdmin.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isUserAdmin
                ? t('admin.users.confirmRevokeAdmin.description')
                : t('admin.users.confirmGrantAdmin.description')}
              <br />
              <span className="font-medium">{userEmail}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>
              {t('admin.common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAdminToggle}
              disabled={isLoading}
              className={isUserAdmin ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {isLoading
                ? t('admin.common.loading')
                : isUserAdmin
                  ? t('admin.users.confirmRevokeAdmin.confirm')
                  : t('admin.users.confirmGrantAdmin.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
