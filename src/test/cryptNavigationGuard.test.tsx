import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCryptNavigationGuard } from '@/hooks/useCryptNavigationGuard';

afterEach(cleanup);
function Harness({ active, work }: { active: string; work: () => void }) {
  const guard = useCryptNavigationGuard(active);
  return <><button onClick={() => guard.run(work)}>Run</button><button onClick={guard.retry}>Retry</button><output>{String(guard.failed)}</output><textarea aria-label="Draft" /></>;
}
describe('local navigation failure isolation', () => {
  it('retains the draft, blocks repeated failures, and resumes only after retry', () => {
    const work = vi.fn((): void => { throw new Error('Synthetic navigation failure'); });
    render(<Harness active="room" work={work} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsent draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(work).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox')).toHaveValue('Unsent draft');
    work.mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(work).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toHaveTextContent('false');
  });
  it('does not block another conversation after a failure', () => {
    const work = vi.fn((): void => { throw new Error('Synthetic navigation failure'); });
    const view = render(<Harness active="room" work={work} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    work.mockImplementation(() => {});
    view.rerender(<Harness active="dm" work={work} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(work).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toHaveTextContent('false');
  });
});