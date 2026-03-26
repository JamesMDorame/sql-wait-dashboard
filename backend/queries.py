# backend/queries.py

BENIGN_WAITS = ",".join([
    "'SLEEP_TASK'", "'SLEEP_SYSTEMTASK'", "'WAITFOR'",
    "'BROKER_TO_FLUSH'", "'BROKER_TASK_STOP'", "'CLR_AUTO_EVENT'",
    "'DISPATCHER_QUEUE_SEMAPHORE'", "'HADR_WORK_QUEUE'",
    "'REQUEST_FOR_DEADLOCK_SEARCH'", "'RESOURCE_QUEUE'",
    "'SERVER_IDLE_CHECK'", "'SLEEP_DBSTARTUP'",
    "'SNI_HTTP_ACCEPT'", "'SP_SERVER_DIAGNOSTICS_SLEEP'",
    "'SQLTRACE_BUFFER_FLUSH'", "'XE_DISPATCHER_WAIT'",
    "'XE_TIMER_EVENT'", "'CHECKPOINT_QUEUE'",
    "'DBMIRROR_EVENTS_QUEUE'", "'ONDEMAND_TASK_MANAGER'",
])

WAIT_STATS_QUERY = f"""
SELECT
    wait_type,
    waiting_tasks_count                        AS tasks,
    wait_time_ms,
    signal_wait_time_ms,
    wait_time_ms - signal_wait_time_ms         AS resource_wait_time_ms,
    max_wait_time_ms,
    CASE WHEN waiting_tasks_count > 0
         THEN CAST(wait_time_ms AS FLOAT) / waiting_tasks_count
         ELSE 0 END                            AS avg_wait_ms,
    CASE
        WHEN wait_type IN (
            'SOS_SCHEDULER_YIELD','CXPACKET','CXCONSUMER','THREADPOOL'
        ) THEN 'CPU'
        WHEN wait_type LIKE 'PAGEIOLATCH%'
          OR wait_type IN ('WRITELOG','ASYNC_IO_COMPLETION',
                           'IO_COMPLETION','NETWORK_IO') THEN 'IO'
        WHEN wait_type IN ('RESOURCE_SEMAPHORE',
            'RESOURCE_SEMAPHORE_QUERY_COMPILE',
            'CMEMTHREAD','SOS_MEMORY_TOPLEVELBLOCKALLOCATOR') THEN 'Memory'
        ELSE 'Other'
    END                                        AS category
FROM sys.dm_os_wait_stats
WHERE wait_type NOT IN ({BENIGN_WAITS})
  AND wait_time_ms > 0
ORDER BY wait_time_ms DESC;
"""

ACTIVE_REQUESTS_QUERY = """
SELECT
    r.session_id,
    r.status,
    r.wait_type,
    r.wait_time                                AS wait_ms,
    r.cpu_time                                 AS cpu_ms,
    r.logical_reads,
    r.command,
    DB_NAME(r.database_id)                     AS db_name,
    r.blocking_session_id,
    SUBSTRING(t.text,
        (r.statement_start_offset/2)+1,
        ((CASE r.statement_end_offset
              WHEN -1 THEN DATALENGTH(t.text)
              ELSE r.statement_end_offset
          END - r.statement_start_offset)/2)+1) AS current_sql
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.session_id > 50
  AND r.session_id <> @@SPID
ORDER BY r.wait_time DESC;
"""
