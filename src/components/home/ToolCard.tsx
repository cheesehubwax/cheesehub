import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface ToolCardProps {
  emoji: string;
  title: string;
  titleHighlight: string;
  description: string;
  highlight?: string;
  linkTo?: string;
  externalLink?: string;
  buttonLabel: string;
  onClick?: () => void;
}

export function ToolCard({
  emoji,
  title,
  titleHighlight,
  description,
  highlight,
  linkTo,
  externalLink,
  buttonLabel,
  onClick,
}: ToolCardProps) {
  const ButtonContent = (
    <>
      {buttonLabel}
      <ArrowRight className="ml-2 h-5 w-5" />
    </>
  );

  return (
    <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20 hover:border-cheese/40 transition-colors">
      <CardContent className="py-12 text-center">
        <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">{emoji}</span>
        </div>
        <h2 className="text-2xl font-bold mb-4">
          <span className="text-cheese">{title}</span>
          <span className="text-foreground">{titleHighlight}</span>
        </h2>
        <p className="text-muted-foreground max-w-sm mx-auto mb-4">
          {description}
        </p>
        {highlight && (
          <p className="text-cheese font-semibold max-w-sm mx-auto mb-6">
            {highlight}
          </p>
        )}
        {!highlight && <div className="mb-6" />}
        
        {linkTo ? (
          <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
            <Link to={linkTo}>{ButtonContent}</Link>
          </Button>
        ) : externalLink ? (
          <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
            <a href={externalLink} target="_blank" rel="noopener noreferrer">
              {ButtonContent}
            </a>
          </Button>
        ) : onClick ? (
          <Button
            size="lg"
            className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold"
            onClick={onClick}
          >
            {ButtonContent}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
