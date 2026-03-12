import { useQuery } from '@tanstack/react-query';
import { useWax } from '@/context/WaxContext';
import { fetchIsAdmin } from '@/lib/adminData';

export function useAdminAccess() {
  const { accountName, isConnected } = useWax();

  const { data: isWhitelisted, isLoading } = useQuery({
    queryKey: ['admin-access', accountName],
    queryFn: () => fetchIsAdmin(accountName!),
    enabled: isConnected && !!accountName,
    staleTime: 5 * 60 * 1000,
  });

  return {
    isWhitelisted: isWhitelisted ?? false,
    isLoading,
    isConnected,
    accountName,
  };
}
