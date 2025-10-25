import React, {forwardRef} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';

const FontAwesomeIconWithTitle = forwardRef(
  ({title, wrapperClassName, wrapperProps, className, ...iconProps}, ref) => {
    if (!title) {
      return <FontAwesomeIcon ref={ref} className={className} {...iconProps} />;
    }

    const {className: wrapperPropsClassName, ...wrapperPropsRest} = wrapperProps ?? {};
    const {['aria-label']: wrapperAriaLabel, role: wrapperRole, ...wrapperRestProps} = wrapperPropsRest;
    const {['aria-label']: iconAriaLabel, ...restIconProps} = iconProps;

    const combinedWrapperClassName = [wrapperPropsClassName, wrapperClassName]
      .filter(Boolean)
      .join(' ') || undefined;

    const computedAriaLabel = wrapperAriaLabel ?? iconAriaLabel ?? title;

    return (
      <span
        {...wrapperRestProps}
        className={combinedWrapperClassName}
        title={title}
        aria-label={computedAriaLabel}
        role={wrapperRole ?? 'img'}
      >
        <FontAwesomeIcon
          ref={ref}
          className={className}
          {...restIconProps}
          title={title}
        />
      </span>
    );
  }
);

FontAwesomeIconWithTitle.displayName = 'FontAwesomeIconWithTitle';

export default FontAwesomeIconWithTitle;
