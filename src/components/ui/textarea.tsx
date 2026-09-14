import * as React from 'react';
import TextareaAutosize, { TextareaAutosizeProps } from 'react-textarea-autosize';

import {cn} from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaAutosizeProps>(
  ({className, value, ...props}, ref) => {
    // Convert null to empty string (fixing potential crashes), 
    // but leave undefined as is to allow uncontrolled usage without warnings.
    const sanitizedValue = value === null ? '' : value;

    return (
      <TextareaAutosize
        className={cn(
          'flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        ref={ref}
        value={sanitizedValue}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export {Textarea};
