import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Rocket, 
  Fire, 
  Users, 
  Trophy,
  Star,
  Lightning
} from '@phosphor-icons/react';

interface MilestoneProps {
  icon: React.ReactNode;
  date: string;
  title: string;
  description: string;
  highlight?: boolean;
}

function Milestone({ icon, date, title, description, highlight }: MilestoneProps) {
  return (
    <div className="relative pl-8 pb-8 last:pb-0">
      {/* Timeline line */}
      <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border/50 last:hidden" />
      
      {/* Timeline dot */}
      <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center ${
        highlight ? 'bg-cheese text-primary-foreground' : 'bg-muted text-muted-foreground'
      }`}>
        {icon}
      </div>
      
      <div>
        <Badge variant="outline" className="mb-2 text-xs">
          {date}
        </Badge>
        <h4 className={`font-semibold mb-1 ${highlight ? 'text-cheese' : 'text-foreground'}`}>
          {title}
        </h4>
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

export function CheeseHistorySection() {
  const milestones = [
    {
      icon: <Rocket size={14} weight="bold" />,
      date: 'March 2021',
      title: 'CHEESE Launch',
      description: 'CHEESE token launched on WAX blockchain with fair distribution model.',
      highlight: true,
    },
    {
      icon: <Fire size={14} weight="bold" />,
      date: 'April 2021',
      title: 'Contract Nulled',
      description: 'Contract keys permanently nulled to eosio.null, making CHEESE fully immutable.',
      highlight: true,
    },
    {
      icon: <Users size={14} weight="bold" />,
      date: 'June 2021',
      title: 'CHEESE Army Forms',
      description: 'Community-driven governance established with dedicated holders.',
    },
    {
      icon: <Lightning size={14} weight="bold" />,
      date: 'September 2021',
      title: 'CHEESEUp Launches',
      description: 'PowerUp utility allowing CHEESE to be used for CPU/NET resources.',
      highlight: true,
    },
    {
      icon: <Star size={14} weight="bold" />,
      date: 'January 2022',
      title: 'CHEESEFaucet Live',
      description: 'Staking mechanism for earning CHEESE rewards goes live.',
    },
    {
      icon: <Trophy size={14} weight="bold" />,
      date: '2023-Present',
      title: 'Ecosystem Expansion',
      description: 'CHEESEDao, CHEESEFarm, CHEESELock, CHEESEDrop, and CHEESEHub deployed.',
      highlight: true,
    },
  ];

  return (
    <Card className="bg-gradient-to-br from-cheese/5 via-background to-cheese-dark/5 border-cheese/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-cheese">CHEESE</span>
          <span className="text-foreground">History</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {milestones.map((milestone, index) => (
            <Milestone key={index} {...milestone} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
