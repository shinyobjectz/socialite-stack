import { ScrollableContainer } from '@affine/component';
import { MenuItem } from '@affine/component/ui/menu';
import { AuthService, DefaultServerService } from '@affine/core/modules/cloud';
import { GlobalDialogService } from '@affine/core/modules/dialogs';
import { type WorkspaceMetadata } from '@affine/core/modules/workspace';
import { ServerFeature } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import { SocialiteLockup } from '@affine/component';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback } from 'react';

import { AddWorkspace } from './add-workspace';
import { AddServerItem } from './add-server';
import * as styles from './index.css';
import { UserAccountItem } from './user-account';
import { WorkspaceList } from './workspace-list';

const SignInItem = () => {
  const t = useI18n();
  const globalDialogService = useService(GlobalDialogService);

  return (
    <MenuItem
      className={styles.signInItem}
      onClick={useCallback(() => {
        globalDialogService.unstable_open('auth', {
          state: 'signIn',
        });
      }, [globalDialogService])}
    >
      <div className={styles.signInWrapper}>
        <div className={styles.iconContainer}>
          <SocialiteLockup wordmarkHeight={20} markSize={20} decorative />
        </div>

        <div className={styles.signInTextContainer}>
          <div className={styles.signInText}>
            {t['com.affine.workspace.user-with-workspace-list.sign-in']()}
          </div>
          <div className={styles.signInDescription}>
            {t[
              'com.affine.workspace.user-with-workspace-list.sign-in-description'
            ]()}
          </div>
        </div>
      </div>
    </MenuItem>
  );
};

export const UserWithWorkspaceList = ({
  onSettingClick,
  onAddWorkspaceClick,
  workspaces,
}: {
  onSettingClick: (workspaceMetadata: WorkspaceMetadata) => void;
  onAddWorkspaceClick: () => void;
  workspaces: WorkspaceMetadata[];
}) => {
  const authService = useService(AuthService);
  const loginStatus = useLiveData(authService.session.status$);
  const serverService = useService(DefaultServerService);
  const serverConfig = useLiveData(serverService.server.config$);

  return (
    <ScrollableContainer
      className={styles.container}
      scrollBarClassName={styles.scrollbar}
    >
      {loginStatus === 'authenticated' ? <UserAccountItem /> : <SignInItem />}

      <WorkspaceList onSettingClick={onSettingClick} workspaces={workspaces} />

      <AddWorkspace onClick={onAddWorkspaceClick} />

      {serverConfig.features.includes(ServerFeature.MultiServer) ? (
        <AddServerItem />
      ) : null}
    </ScrollableContainer>
  );
};
