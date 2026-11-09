/**
 * ⚡ Lazy Component Preloaders
 * Preloads dynamic chunks on hover or pointerdown so chunks are loaded
 * before the user even completes the tap/click.
 */

export const loadMissionsView   = () => import('../components/features/MissionsView');
export const loadNetworkView    = () => import('../components/features/NetworkView');
export const loadNewsView       = () => import('../components/features/NewsView');
export const loadGroupsView     = () => import('../components/features/GroupsView');
export const loadAdminDashboard = () => import('../components/features/AdminDashboard');
export const loadERPView        = () => import('../components/features/erp/ERPView');
export const loadAboutPage      = () => import('../components/features/AboutPage');
export const loadProfilePage    = () => import('../components/features/profile/ProfilePage');
export const loadServicesView   = () => import('../components/features/services/ServicesView');
export const loadSettingsPage   = () => import('../components/features/settings/SettingsPage');

export const preloadTab = (tab: string) => {
  switch (tab) {
    case 'jobs':
    case 'post-job':
      loadMissionsView();
      break;
    case 'network':
      loadNetworkView();
      break;
    case 'news':
      loadNewsView();
      break;
    case 'groups':
      loadGroupsView();
      break;
    case 'about':
      loadAboutPage();
      break;
    case 'profile':
      loadProfilePage();
      break;
    case 'services':
      loadServicesView();
      break;
    case 'settings':
      loadSettingsPage();
      break;
    case 'erp':
      loadERPView();
      break;
    case 'admin':
      loadAdminDashboard();
      break;
    default:
      break;
  }
};

