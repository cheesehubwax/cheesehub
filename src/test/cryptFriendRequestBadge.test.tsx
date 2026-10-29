import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CryptSidebar } from '@/components/crypt/CryptSidebar';
import { countFriendRequests, type InviteGroupView } from '@/lib/cryptInviteGroups';
import type { MessagingKey } from '@/lib/cheeseCrypt';

const view = (id: string, status: InviteGroupView['status'], friendRequests: string[], creator = 'owner'): InviteGroupView =>
  ({ invite: { id, creator, members: [creator, ...friendRequests], name: id }, name: id, status, isCreator: false,
    joined: [], pending: [], friendRequests, requested: [], accepted: [] }) as unknown as InviteGroupView;

describe('Friends heading friend-request counter', () => {
  it('counts unanswered requests across groups, deduplicated by account', () => {
    const views = [view('g1', 'joined', ['bob', 'carol']), view('g2', 'joined', ['bob', 'dan'])];
    expect(countFriendRequests(views, {}, [], [])).toBe(3);
  });

  it('ignores friends, blocked accounts and declined requests', () => {
    const views = [view('g1', 'joined', ['bob', 'carol', 'dan']), view('g2', 'joined', ['erin'])];
    // bob is already a friend, dan declined in g1, carol is blocked, erin's group is declined.
    expect(countFriendRequests(views, { bob: 'KEY' }, ['carol'], ['g1:dan'])).toBe(0);
  });

  it('ignores requests arriving through a group I declined or whose creator I blocked', () => {
    const views = [view('g1', 'declined', ['bob']), view('g2', 'invited', ['carol'], 'troll')];
    expect(countFriendRequests(views, {}, ['troll'], [])).toBe(0);
  });
});

const key = { type: 'gpk-msg-key', version: 1, account: 'alice', publicKey: 'PUB', secretKey: 'SEC', created: '2026-01-01T00:00:00Z' } as MessagingKey;
const stubs = {
  account: 'alice', cryptKey: key, loading: false, refresh: vi.fn(), setEditingAvatar: vi.fn(), menuOpen: false, setMenuOpen: vi.fn(),
  fileRef: { current: null }, sharePublicKey: vi.fn(), busy: false, publish: vi.fn(), blocked: [] as string[], setShowBlocked: vi.fn(),
  makeKey: vi.fn(), publicInbox: false, setInboxOpen: vi.fn(), toggleList: vi.fn(), listHidden: false, hiddenUnread: 0, hiddenReplies: 0,
  messageRequests: [], acceptRequest: vi.fn(), dismissRequest: vi.fn(), blockAccount: vi.fn(), groupsOpen: true, setGroupsOpen: vi.fn(),
  setCreatingGroup: vi.fn(), inviteViews: [], inviteShown: () => true, hiddenGroups: [] as string[], inviteRow: () => null, groups: [],
  groupRow: () => null, showHiddenGroups: false, setShowHiddenGroups: vi.fn(), friendsOpen: true, setFriendsOpen: vi.fn(),
  setAddingFriend: vi.fn(), partners: [], active: null, setActive: vi.fn(), avatars: {}, nameFor: (n: string) => n,
  contacts: {}, lastAt: {}, badge: () => null, removeFriend: vi.fn(), setRoomsOpen: vi.fn(),
};

describe('Friends heading badge rendering', () => {
  it('shows the counter on the Friends heading, styled like unread messages', () => {
    render(<CryptSidebar {...stubs} friendRequests={2} />);
    expect(screen.getByLabelText('2 unanswered friend requests')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows nothing when there are no pending friend requests', () => {
    render(<CryptSidebar {...stubs} friendRequests={0} />);
    expect(screen.queryByLabelText(/unanswered friend request/)).toBeNull();
  });

  it('caps the counter at 99+', () => {
    render(<CryptSidebar {...stubs} friendRequests={120} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });
});
