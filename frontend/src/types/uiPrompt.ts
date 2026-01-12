export type UiPromptVariant = 'default' | 'primary' | 'danger';

export type UiPrompt =
  | {
      kind: 'alert';
      title: string;
      message: string;
      confirmText?: string;
      destructive?: boolean;
      resolve: (value: void) => void;
    }
  | {
      kind: 'confirm';
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      destructive?: boolean;
      resolve: (value: boolean) => void;
    }
  | {
      kind: 'choice3';
      title: string;
      message: string;
      primaryText: string;
      secondaryText: string;
      tertiaryText: string;
      primaryVariant?: UiPromptVariant;
      secondaryVariant?: UiPromptVariant;
      tertiaryVariant?: UiPromptVariant;
      resolve: (value: 'primary' | 'secondary' | 'tertiary') => void;
    };
