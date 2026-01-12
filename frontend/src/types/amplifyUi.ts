import type { useAuthenticator } from '@aws-amplify/ui-react-native/dist';

export type AmplifyUiUser = ReturnType<typeof useAuthenticator>['user'];
