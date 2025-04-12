import React from 'react';

const DayTypeCheckbox = ({ type, selected, onChange = '' }) => {
  return (
    <div className={`day-type-item`}>
      <input
        type="checkbox"
        id={`dayType-${type._id}`}
        value={type._id}
        onChange={(e) => onChange(type._id, e.target.checked)}
        checked={selected}
      />
      <label htmlFor={`dayType-${type._id}`}>
        <span className="color-indicator" style={{ backgroundColor: type.color }} />
        {type.name}
      </label>
    </div>
  );
};

export default DayTypeCheckbox;
