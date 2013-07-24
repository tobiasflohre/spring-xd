/*
 * Copyright 2013 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.springframework.xd.dirt.stream.redis;

import org.springframework.data.redis.core.RedisOperations;
import org.springframework.xd.dirt.stream.JobDefinition;
import org.springframework.xd.dirt.stream.JobDefinitionRepository;
import org.springframework.xd.store.AbstractRedisRepository;

/**
 * An implementation of {@link JobDefinitionRepository} that persists @{link JobDefinition} in Redis.
 * 
 * @author Glenn Renfro
 */
public class RedisJobDefinitionRepository extends AbstractRedisRepository<JobDefinition, String> implements
		JobDefinitionRepository {

	public RedisJobDefinitionRepository(RedisOperations<String, String> redisOperations) {
		super("jobs.", redisOperations);
	}

	@Override
	protected JobDefinition deserialize(String v) {
		String[] parts = v.split("\n");
		return new JobDefinition(parts[0], parts[1]);
	}

	@Override
	protected String serialize(JobDefinition entity) {
		return entity.getName() + "\n" +  entity.getDefinition();
	}

	protected String keyFor(JobDefinition entity) {
		return entity.getName();
	}

	@Override
	protected String serializeId(String id) {
		return id;
	}
}
