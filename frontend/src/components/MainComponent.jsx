import React, { useState, useEffect } from 'react';
import CalendarComponent from './CalendarComponent';

const API_URL = process.env.REACT_APP_API_URL;

const MainComponent = ({ authHeader, onLogout }) => {
    const [data, setData] = useState(null);

    const fetchData = async () => {
        try {
            const response = await fetch(API_URL + '/', {
                headers: authHeader ? { 'Authorization': authHeader } : {}
            });
            if (response.status === 401) {
                onLogout();
                return;
            }
            const data = await response.json();
            setData(data);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, [authHeader, onLogout]);

    if (!data) return <div>Loading...</div>;

    return (
        <CalendarComponent
            teamData={data.teams}
            holidays={data.holidays}
            currentMonth={new Date()}
            updateTeamData={fetchData}
            authHeader={authHeader}
        />
    );
};

export default MainComponent;
