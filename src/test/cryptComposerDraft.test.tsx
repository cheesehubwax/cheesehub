import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState, createRef } from 'react';
import { CryptComposer } from '@/components/crypt/CryptComposer';

function Harness({ onSend, external }: { onSend: (t: string) => void; external?: (set: (t: string) => void) => void }) {
  const [text, setText] = useState('hello world');
  external?.(setText);
  return <CryptComposer account="a" active="b" activeGroup={undefined} activeInvite={undefined} nameFor={x => x}
    replyingTo={null} setReplyingTo={() => {}} composerRef={createRef()} text={text} setText={setText} voice={null} setVoice={() => {}}
    tooLong={false} bytes={0} maxBytes={100} parts={1} copies={1} voiceParts={0} voiceTxs={0} setAttachingNft={() => {}}
    busy={false} listHidden={false} agreed setAgreed={() => {}} totalCost="" send={() => onSend(text)} sendVoice={() => {}} />;
}

describe('CryptComposer draft', () => {
  it('fast repeated deletes end with the exact text', () => {
    render(<Harness onSend={() => {}} />);
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    let v = 'hello world';
    for (let i = 0; i < 6; i++) { v = v.slice(0, -1); fireEvent.change(box, { target: { value: v } }); }
    expect(box.value).toBe('hello');
  });
  it('Send right after typing uses the newest text', async () => {
    const onSend = vi.fn();
    render(<Harness onSend={onSend} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello there' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })); });
    expect(onSend).toHaveBeenLastCalledWith('hello there');
  });
  it('external clears update the box', () => {
    let set!: (t: string) => void;
    render(<Harness onSend={() => {}} external={s => { set = s; }} />);
    act(() => set(''));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });
  it('a late echo of earlier typing never resets the box mid-edit', () => {
    let set!: (t: string) => void;
    render(<Harness onSend={() => {}} external={s => { set = s; }} />);
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'hello Xworld' } });
    fireEvent.change(box, { target: { value: 'hello XYworld' } });
    act(() => set('hello Xworld'));
    expect(box.value).toBe('hello XYworld');
  });
});
