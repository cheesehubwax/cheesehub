import { SessionKit, ChainDefinition, Session } from '@wharfkit/session';
import { WebRenderer } from '@wharfkit/web-renderer';
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor';
import { WalletPluginCloudWallet } from '@wharfkit/wallet-plugin-cloudwallet';
import { TransactPluginResourceProvider } from '@wharfkit/transact-plugin-resource-provider';

// Initialize the WebRenderer for wallet selection UI
const webRenderer = new WebRenderer();

// WAX mainnet chain ID for Greymass Fuel endpoint
export const WAX_CHAIN_ID = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4';

// Define WAX mainnet with a more reliable primary RPC endpoint
const waxChain = ChainDefinition.from({
  id: WAX_CHAIN_ID,
  url: 'https://wax.eosusa.io',
});

// Create SessionKit WITHOUT Fuel resource provider by default
// Fuel only works with Anchor wallet - Cloud Wallet doesn't support the co-signing flow
export const sessionKit = new SessionKit({
  appName: 'CHEESEHub',
  chains: [waxChain],
  ui: webRenderer,
  walletPlugins: [
    new WalletPluginAnchor(),
    new WalletPluginCloudWallet(),
  ],
});

// Helper to check if session is from Anchor wallet (supports Fuel co-signing)
export function isAnchorSession(session: Session): boolean {
  // Check multiple properties to ensure accurate detection
  const walletId = session.walletPlugin?.id || '';
  const walletName = (session.walletPlugin as any)?.metadata?.name || '';

  // Log for debugging
  console.log('[WharfKit] Wallet detection:', { walletId, walletName });

  // Cloud Wallet uses 'cloudwallet' or 'wax-cloud-wallet' as ID
  // Anchor uses 'anchor' in its ID
  const isAnchor = walletId.toLowerCase().includes('anchor');
  const isCloudWallet = walletId.toLowerCase().includes('cloud') ||
                        walletId.toLowerCase().includes('wax-cloud') ||
                        walletName.toLowerCase().includes('cloud');

  console.log('[WharfKit] Session type:', { isAnchor, isCloudWallet });

  return isAnchor && !isCloudWallet;
}

// Get transact options with Fuel plugin for Anchor-only sessions
// Cloud Wallet doesn't support Fuel's partial signature flow
export function getTransactPlugins(session: Session) {
  const useAnchorPlugins = isAnchorSession(session);
  console.log('[WharfKit] getTransactPlugins - using Fuel:', useAnchorPlugins);

  if (useAnchorPlugins) {
    return [
      new TransactPluginResourceProvider({
        endpoints: {
          [WAX_CHAIN_ID]: 'https://wax.greymass.com',
        },
        // Don't allow paid Fuel - only use free resource sponsorship
        allowFees: false,
      }),
    ];
  }
  // Return empty array for Cloud Wallet - no Fuel support
  console.log('[WharfKit] Returning EMPTY plugins for Cloud Wallet');
  return [];
}

// Track if a login is in progress to avoid removing modal during login
let isLoginInProgress = false;
let loginProtectionTimeout: ReturnType<typeof setTimeout> | null = null;

export function setLoginInProgress(value: boolean) {
  isLoginInProgress = value;

  // Clear any existing timeout
  if (loginProtectionTimeout) {
    clearTimeout(loginProtectionTimeout);
    loginProtectionTimeout = null;
  }

  // If starting login, set a safety timeout to auto-reset after 60 seconds
  // This prevents getting permanently stuck if login fails silently
  if (value) {
    loginProtectionTimeout = setTimeout(() => {
      isLoginInProgress = false;
      loginProtectionTimeout = null;
    }, 60000);
  }
}

export function isLoginActive() {
  return isLoginInProgress;
}

// Utility to close any stuck Wharfkit modals - more aggressive cleanup
export function closeWharfkitModals() {
  // CRITICAL: Skip ALL cleanup if login is in progress
  if (isLoginInProgress) {
    console.log('Skipping modal cleanup - login in progress');
    return;
  }

  // IMPORTANT: Do NOT remove #wharfkit-web-ui container!
  // The WebRenderer holds a reference to it, and removing it causes
  // "element is not in a Document" errors on subsequent logins.
  // Instead, just close any open dialogs within it.
  const wharfkitEl = document.getElementById('wharfkit-web-ui');

  if (wharfkitEl?.shadowRoot) {
    // Close any open dialogs by calling close() method
    const openDialogs = wharfkitEl.shadowRoot.querySelectorAll('dialog[open]');
    openDialogs.forEach((dialog) => {
      try {
        (dialog as HTMLDialogElement).close();
      } catch (e) {
        // Dialog might already be closed
      }
    });
  }

  const modalSelectors = [
    'wharf-modal',
    '.wharf-modal',
    '[class*="wharfkit"]:not(#wharfkit-web-ui)',
    '[class*="wharf-"]',
    'wharfkit-modal',
    '.wharfkit-modal',
    '[data-wharfkit]',
    '.prompt-modal',
    '.prompt-overlay',
    '[class*="prompt-"]',
    '[class*="anchor-link"]',
    '.anchor-link-modal',
  ];

  modalSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        if (el.id !== 'wharfkit-web-ui') {
          el.remove();
        }
      });
    } catch (e) {
      // Ignore invalid selectors
    }
  });

  // Remove any fixed/absolute positioned overlays that might be blocking
  document.querySelectorAll('body > div').forEach(el => {
    const style = window.getComputedStyle(el);
    if (
      (style.position === 'fixed' || style.position === 'absolute') &&
      style.zIndex && parseInt(style.zIndex) > 9000 &&
      el.id !== 'root' &&
      el.id !== 'wharfkit-web-ui' &&
      !el.closest('[data-radix-portal]')
    ) {
      if (style.backgroundColor?.includes('rgba') || el.querySelector('[class*="modal"]')) {
        el.remove();
      }
    }
  });

  // Reset body scroll if it was locked
  document.body.style.overflow = '';
  document.body.style.pointerEvents = '';
  document.body.style.position = '';
  document.body.classList.remove('overflow-hidden', 'modal-open');

  // Restore pointer events on Radix portals
  document.querySelectorAll('[data-radix-portal], [role="dialog"]').forEach(el => {
    (el as HTMLElement).style.pointerEvents = '';
  });
}

// Function to ensure WharfKit modals are always on top with proper pointer events
export function ensureModalOnTop() {
  const wharfkitEl = document.getElementById('wharfkit-web-ui');
  if (wharfkitEl) {
    // Use setProperty with 'important' to override any CSS rules
    wharfkitEl.style.setProperty('z-index', '999999', 'important');
    wharfkitEl.style.setProperty('position', 'fixed', 'important');
    wharfkitEl.style.setProperty('top', '0', 'important');
    wharfkitEl.style.setProperty('left', '0', 'important');
    wharfkitEl.style.setProperty('width', '100vw', 'important');
    wharfkitEl.style.setProperty('height', '100vh', 'important');
    wharfkitEl.style.setProperty('pointer-events', 'auto', 'important');

    // Inject styles into shadow DOM to fix z-index and pointer-events
    if (wharfkitEl.shadowRoot) {
      const dialog = wharfkitEl.shadowRoot.querySelector('dialog');
      if (dialog) {
        (dialog as HTMLElement).style.setProperty('z-index', '999999', 'important');
        (dialog as HTMLElement).style.setProperty('position', 'fixed', 'important');
        (dialog as HTMLElement).style.setProperty('pointer-events', 'auto', 'important');
      }

      const backdrop = wharfkitEl.shadowRoot.querySelector('.backdrop, [class*="backdrop"]');
      if (backdrop) {
        (backdrop as HTMLElement).style.setProperty('z-index', '999998', 'important');
        (backdrop as HTMLElement).style.setProperty('pointer-events', 'auto', 'important');
      }
    }
  }
}

// Centralized transaction error parsing for WharfKit/Fuel errors
export interface TransactErrorInfo {
  type: 'fuel_rejected' | 'fuel_unreachable' | 'cpu_billing' | 'net_billing' | 'not_broadcast' | 'cancelled' | 'generic';
  title: string;
  description: string;
  duration: number;
}

export function parseTransactError(error: unknown): TransactErrorInfo {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  // Nested cause chain - dig into WharfKit error wrapping
  const causeMsg = (error as any)?.cause?.message?.toLowerCase() || '';
  const allMsg = lower + ' ' + causeMsg;

  console.error('[WharfKit] Transaction error details:', {
    message: msg,
    cause: (error as any)?.cause?.message,
    causeOfCause: (error as any)?.cause?.cause?.message,
    stack: error instanceof Error ? error.stack : undefined,
  });

  // User cancelled
  if (allMsg.includes('cancelled') || allMsg.includes('canceled') || allMsg.includes('rejected by user') || allMsg.includes('user rejected')) {
    return {
      type: 'cancelled',
      title: 'Transaction cancelled',
      description: 'You cancelled the transaction in your wallet.',
      duration: 4000,
    };
  }

  // Fuel/resource provider specific rejections
  if (allMsg.includes('resource provider') || allMsg.includes('fuel') || allMsg.includes('cosign')) {
    return {
      type: 'fuel_rejected',
      title: 'Resource sponsorship declined',
      description: 'Greymass Fuel declined to sponsor this transaction. This can happen when Fuel is at its daily limit or the transaction type is not eligible. Try again later, or ensure your account has some CPU staked.',
      duration: 12000,
    };
  }

  // Network/endpoint failures
  if (allMsg.includes('fetch') || allMsg.includes('network') || allMsg.includes('econnrefused') || allMsg.includes('timeout') || allMsg.includes('failed to fetch') || allMsg.includes('503') || allMsg.includes('502')) {
    return {
      type: 'fuel_unreachable',
      title: 'Network error',
      description: 'Could not reach the blockchain endpoint or Greymass Fuel service. Check your internet connection and try again.',
      duration: 10000,
    };
  }

  // CPU billing failure (Fuel attempted but chain still billed user)
  if (allMsg.includes('cpu') || allMsg.includes('billed') || allMsg.includes('deadline exceeded')) {
    return {
      type: 'cpu_billing',
      title: 'Not enough CPU',
      description: 'Greymass Fuel was attempted but the chain still billed your account for CPU. Fuel may be temporarily unavailable or at its daily limit. Try again in a few minutes, or ask someone to stake a small amount of CPU to your account.',
      duration: 12000,
    };
  }

  // NET billing failure
  if (allMsg.includes('net usage') || allMsg.includes('net exceeded')) {
    return {
      type: 'net_billing',
      title: 'Not enough NET',
      description: 'Your account does not have enough NET bandwidth. Try again later or stake some NET to your account.',
      duration: 10000,
    };
  }

  // Generic fallback
  return {
    type: 'generic',
    title: 'Transaction failed',
    description: msg.length > 200 ? msg.slice(0, 200) + '…' : msg,
    duration: 8000,
  };
}

// Restore pointer events on Radix elements
export function restoreRadixPointerEvents() {
  document.querySelectorAll('[data-radix-portal], [role="dialog"]').forEach(el => {
    (el as HTMLElement).style.pointerEvents = '';
  });
}

// Auto-elevate WharfKit modals when they appear in the DOM
if (typeof window !== 'undefined') {
  const initObserver = () => {
    if (!document.body) {
      setTimeout(initObserver, 50);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.id === 'wharfkit-web-ui' || node.id?.startsWith('wharfkit')) {
              // Ensure high z-index and full interactivity
              node.style.setProperty('z-index', '999999', 'important');
              node.style.setProperty('position', 'fixed', 'important');
              node.style.setProperty('pointer-events', 'auto', 'important');

              // Style shadow DOM elements
              const styleShadowDOM = () => {
                if (node.shadowRoot) {
                  // Style the dialog
                  const dialog = node.shadowRoot.querySelector('dialog');
                  if (dialog) {
                    (dialog as HTMLElement).style.setProperty('z-index', '999999', 'important');
                    (dialog as HTMLElement).style.setProperty('pointer-events', 'auto', 'important');
                  }
                  // Style all interactive elements inside shadow DOM
                  node.shadowRoot.querySelectorAll('button, a, input, [role="button"]').forEach(el => {
                    (el as HTMLElement).style.setProperty('pointer-events', 'auto', 'important');
                  });
                }
              };

              styleShadowDOM();
              setTimeout(styleShadowDOM, 50);
              setTimeout(styleShadowDOM, 150);
              setTimeout(styleShadowDOM, 300);
              setTimeout(styleShadowDOM, 500);
            }
          }
        }

        // Cleanup when modal is removed
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLElement && (node.id === 'wharfkit-web-ui' || node.id?.startsWith('wharfkit'))) {
            document.querySelectorAll('[data-radix-portal]').forEach(el => {
              (el as HTMLElement).style.pointerEvents = '';
            });
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initObserver, 100));
  } else {
    setTimeout(initObserver, 100);
  }
}
