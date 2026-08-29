import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Megaphone } from '@phosphor-icons/react';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format, eachDayOfInterval, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useWax } from '@/context/WaxContext';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';

export function AddBannerSlotsCard() {
  const { session, accountName } = useWax();
  const { executeTransaction } = useWaxTransaction(session);

  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [positions, setPositions] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  const slots = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return [];
    return eachDayOfInterval({ start: startOfDay(startDate), end: startOfDay(endDate) }).map(day => {
      const yyyy = day.getFullYear();
      const mm = String(day.getMonth() + 1).padStart(2, '0');
      const dd = String(day.getDate()).padStart(2, '0');
      const timestamp = new Date(`${yyyy}-${mm}-${dd}T14:00:00Z`).getTime() / 1000;
      return { date: day, timestamp };
    });
  }, [startDate, endDate]);

  const handleCreate = async () => {
    if (!accountName || slots.length === 0 || positions < 1) return;
    setSubmitting(true);
    try {
      const actions = slots.map(slot => ({
        account: 'cheesebannad',
        name: 'initbannerad',
        authorization: [{ actor: accountName, permission: 'active' }],
        data: {
          start_time: slot.timestamp,
          amount_of_slots: positions,
        },
      }));
      await executeTransaction(actions, {
        successTitle: 'Banner Slots Created',
        successDescription: `Created ${slots.length} day(s) × ${positions} position(s)`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border border-border/50 col-span-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="h-5 w-5 text-orange-400" />
          Add Banner Slots
          <Badge variant="outline" className="ml-auto text-xs">initbannerad</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          {/* Start Date */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PPP') : 'Pick start'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PPP') : 'Pick end'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Positions */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Positions per Day</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={positions}
              onChange={e => setPositions(Math.max(1, Number(e.target.value)))}
            />
          </div>
        </div>

        {/* Preview Table */}
        {slots.length > 0 && (
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Date</th>
                    <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">14:00 UTC Timestamp</th>
                    <th className="text-right px-3 py-1.5 text-muted-foreground font-medium">Positions</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map(slot => (
                    <tr key={slot.timestamp} className="border-t border-border/30">
                      <td className="px-3 py-1.5 text-foreground">{format(slot.date, 'EEE, MMM d yyyy')}</td>
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{slot.timestamp}</td>
                      <td className="px-3 py-1.5 text-right text-foreground">{positions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground border-t border-border/30">
              Total: {slots.length} day(s) × {positions} position(s) = {slots.length * positions} slot(s)
            </div>
          </div>
        )}

        <Button
          onClick={handleCreate}
          disabled={submitting || slots.length === 0 || positions < 1}
          className="w-full sm:w-auto"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {submitting ? 'Creating…' : `Create ${slots.length} Slot${slots.length !== 1 ? 's' : ''}`}
        </Button>
      </CardContent>
    </Card>
  );
}
