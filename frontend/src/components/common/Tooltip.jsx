import React, {useCallback, useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import './Tooltip.css';

const DEFAULT_OFFSET = 12;
const SHOW_DELAY = 150;
const HIDE_DELAY = 100;

const isDomAvailable = () => typeof window !== 'undefined' && typeof document !== 'undefined';

const Tooltip = ({
  children,
  content,
  placement = 'top',
  offset = DEFAULT_OFFSET,
  delay = SHOW_DELAY,
  hideDelay = HIDE_DELAY,
  className = '',
}) => {
  if (!React.isValidElement(children)) {
    return null;
  }

  const {
    onMouseEnter: childOnMouseEnter,
    onMouseLeave: childOnMouseLeave,
    onFocus: childOnFocus,
    onBlur: childOnBlur,
    onTouchStart: childOnTouchStart,
    onTouchEnd: childOnTouchEnd,
    tabIndex: childTabIndex,
    ...restChildProps
  } = children.props;

  const [visible, setVisible] = useState(false);
  const [triggerRect, setTriggerRect] = useState(null);
  const showTimeoutRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  const tooltipId = useId();

  const clearShowTimeout = () => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
  };

  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const hideTooltip = useCallback(() => {
    clearShowTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      setTriggerRect(null);
    }, hideDelay);
  }, [hideDelay]);

  const showTooltip = useCallback((event) => {
    if (!content) {
      return;
    }
    clearHideTimeout();
    showTimeoutRef.current = setTimeout(() => {
      const rect = event.currentTarget.getBoundingClientRect();
      setTriggerRect({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      });
      setVisible(true);
    }, delay);
  }, [content, delay]);

  useEffect(() => () => {
    clearShowTimeout();
    clearHideTimeout();
  }, []);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const handleScrollOrResize = () => {
      setVisible(false);
      setTriggerRect(null);
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [visible]);

  const getTooltipStyle = () => {
    if (!triggerRect) {
      return {};
    }

    const basePositions = {
      top: {
        top: triggerRect.top - offset,
        left: triggerRect.left + triggerRect.width / 2,
        transform: 'translate(-50%, -100%)',
      },
      bottom: {
        top: triggerRect.top + triggerRect.height + offset,
        left: triggerRect.left + triggerRect.width / 2,
        transform: 'translate(-50%, 0)',
      },
      left: {
        top: triggerRect.top + triggerRect.height / 2,
        left: triggerRect.left - offset,
        transform: 'translate(-100%, -50%)',
      },
      right: {
        top: triggerRect.top + triggerRect.height / 2,
        left: triggerRect.left + triggerRect.width + offset,
        transform: 'translate(0, -50%)',
      },
    };

    return basePositions[placement] || basePositions.top;
  };

  const handleMouseEnter = useCallback((event) => {
    showTooltip(event);
    if (childOnMouseEnter) {
      childOnMouseEnter(event);
    }
  }, [childOnMouseEnter, showTooltip]);

  const handleMouseLeave = useCallback((event) => {
    hideTooltip();
    if (childOnMouseLeave) {
      childOnMouseLeave(event);
    }
  }, [childOnMouseLeave, hideTooltip]);

  const handleFocus = useCallback((event) => {
    showTooltip(event);
    if (childOnFocus) {
      childOnFocus(event);
    }
  }, [childOnFocus, showTooltip]);

  const handleBlur = useCallback((event) => {
    hideTooltip();
    if (childOnBlur) {
      childOnBlur(event);
    }
  }, [childOnBlur, hideTooltip]);

  const handleTouchStart = useCallback((event) => {
    showTooltip(event);
    if (childOnTouchStart) {
      childOnTouchStart(event);
    }
  }, [childOnTouchStart, showTooltip]);

  const handleTouchEnd = useCallback((event) => {
    hideTooltip();
    if (childOnTouchEnd) {
      childOnTouchEnd(event);
    }
  }, [childOnTouchEnd, hideTooltip]);

  const childProps = {
    ...restChildProps,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  };

  if (content) {
    childProps['aria-describedby'] = `${tooltipId}`;
  }

  if (childTabIndex !== undefined) {
    childProps.tabIndex = childTabIndex;
  } else if (typeof restChildProps.onClick === 'function') {
    childProps.tabIndex = 0;
  }

  const tooltipElement = visible && content && isDomAvailable()
    ? createPortal(
      <div
        id={tooltipId}
        className={`tooltip-bubble tooltip-${placement} ${className}`.trim()}
        style={getTooltipStyle()}
        role="tooltip"
        data-show={visible}
      >
        {content}
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      {React.cloneElement(children, childProps)}
      {tooltipElement}
    </>
  );
};

export default Tooltip;
