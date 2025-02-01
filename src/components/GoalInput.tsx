import React, { useState, useCallback } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  VStack,
  useToast,
  Text
} from '@chakra-ui/react'
import { QueryGenerator } from '@/services/search/QueryGenerator'

interface GoalInputProps {
  onSubmit: (queries: string[], industry: string, service: string) => void
  isProcessing?: boolean
}

export const GoalInput: React.FC<GoalInputProps> = ({ onSubmit, isProcessing = false }) => {
  const [goal, setGoal] = useState('')
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const queryGenerator = new QueryGenerator()

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!goal.trim()) {
      setError('Please enter your business goal')
      return
    }

    try {
      setError(null)
      const result = await queryGenerator.generateQueries(goal.trim())
      
      onSubmit(
        result.queries,
        result.targetIndustry,
        result.serviceOffering
      )

      toast({
        title: 'Queries generated successfully',
        description: `Generated ${result.queries.length} search queries for ${result.targetIndustry} industry`,
        status: 'success',
        duration: 5000,
        isClosable: true
      })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
      setError(errorMessage)
      toast({
        title: 'Error generating queries',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    }
  }, [goal, onSubmit, toast])

  return (
    <Box as="form" onSubmit={handleSubmit} width="100%">
      <VStack spacing={4} align="stretch">
        <FormControl isInvalid={!!error}>
          <FormLabel htmlFor="goal">
            What service do you offer and to which industry?
          </FormLabel>
          <Input
            id="goal"
            placeholder="e.g. I make websites for dentists"
            value={goal}
            onChange={(e) => {
              setGoal(e.target.value)
              setError(null)
            }}
            isDisabled={isProcessing}
          />
          <FormErrorMessage>{error}</FormErrorMessage>
          <Text fontSize="sm" color="gray.600" mt={2}>
            Be specific about your service and target industry for better results
          </Text>
        </FormControl>
        <Button
          type="submit"
          colorScheme="blue"
          isLoading={isProcessing}
          loadingText="Generating queries..."
          isDisabled={!goal.trim() || isProcessing}
        >
          Generate Search Queries
        </Button>
      </VStack>
    </Box>
  )
} 