import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useWax } from '@/context/WaxContext';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { Loader2 } from 'lucide-react';

interface NullButtonProps {
  disabled?: boolean;
  onBurnSuccess?: () => void;
}

export function NullButton({ disabled = false, onBurnSuccess }: NullButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [isTransacting, setIsTransacting] = useState(false);
  const { session, isConnected } = useWax();
  const { executeTransaction } = useWaxTransaction(session);

  const isDisabled = disabled || !isConnected || isTransacting;

  const handleClick = async () => {
    if (isDisabled || !session) return;
    setIsTransacting(true);

    try {
      const callerName = session.actor.toString();
      const burnAction = {
        account: 'cheeseburner',
        name: 'burn',
        authorization: [{ actor: callerName, permission: 'active' }],
        data: { caller: callerName },
      };

      const result = await executeTransaction([burnAction], {
        successTitle: 'NULL Successful! ',
        successDescription: 'Vote rewards claimed, CHEESE burned, and WAX compounded.',
        errorTitle: 'NULL Failed',
      });

      if (result.success && onBurnSuccess) {
        onBurnSuccess();
      }
    } finally {
      setIsTransacting(false);
    }
  };

  const getButtonText = () => {
    if (isTransacting) {
      return (
        <span className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          NULLING...
        </span>
      );
    }
    return 'NULL';
  };

  const getHintText = () => {
    if (!isConnected) return 'Connect wallet first';
    if (disabled) return 'Waiting for cooldown';
    return null;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleClick}
        onMouseDown={() => !isDisabled && setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        disabled={isDisabled}
        className={cn(
          'relative px-16 py-6 rounded-xl',
          'text-primary-foreground font-black text-4xl tracking-widest',
          'transition-all duration-150 ease-out',
          'focus:outline-none focus:ring-4 focus:ring-primary/50',
          'select-none',
          !isDisabled && [
            'bg-gradient-to-r from-cheese to-cheese-dark',
            'hover:shadow-[0_0_30px_rgba(255,204,0,0.4)]',
            'active:scale-95',
            'cursor-pointer',
            isPressed && 'scale-95 shadow-[0_0_30px_rgba(255,204,0,0.6)]',
          ],
          isDisabled && [
            'bg-muted',
            'text-muted-foreground',
            'cursor-not-allowed',
            'opacity-60',
          ]
        )}
      >
        <span className="relative z-10 drop-shadow-lg">{getButtonText()}</span>
        {!isDisabled && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent via-transparent to-white/20 pointer-events-none" />
        )}
      </button>
      {getHintText() && (
        <span className="text-sm text-muted-foreground">{getHintText()}</span>
      )}
    </div>
  );
}
