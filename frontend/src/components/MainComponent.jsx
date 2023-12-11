import React, { useState, useEffect } from 'react';
import CalendarComponent from './CalendarComponent';
import { apiInstance } from "../api";

const MainComponent = ({ authHeader }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        apiInstance.get('/').then(res => {
            setData(res.data);
        }).catch(error => {
            console.error('Error fetching data:', error)
        }).finally(() => {
            setLoading(false);
        })
    }, [authHeader]);

    const fetchTeamData = async () => {
        try {
            const response = await apiInstance.get('/');
            setData(response.data);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    if (loading) return <div>Loading...</div>;

    if (data && data.teams) {
        return (
          <CalendarComponent
            teamData={data.teams}
            holidays={data.holidays}
            currentMonth={new Date()}
            updateTeamData={fetchTeamData}
            authHeader={authHeader}
          />
        );
    }

    if (!data?.teams) {
        return <div>No data found</div>;
    }

    return null;
};

export default MainComponent;
